var git = require('nodegit');
var archiver = require('archiver');
var fs = require('fs');
var aws = require('aws-sdk');
var rimraf = require("rimraf");

exports.myHandler = function(event, context) {
    var repoName = event.pullrequest.destination.repository.name;
    var repoFullName = event.pullrequest.destination.repository.full_name;
    var branchName = event.pullrequest.destination.branch.name;

    cloneRepo(repoName, repoFullName, branchName, context);
}

cloneRepo = function(repoName, repoFullName, branchName, context) {
    var options = {
        checkoutBranch: branchName,
        fetchOpts: {
            callbacks: {
                certificateCheck: function() {
                    return 1;
                },
                credentials: function(url, userName) {
                    return git.Cred.sshKeyNew(
                        userName,
                        'id_rsa.pub',
                        'id_rsa',
                        'g!250953');
                }
            }
        }
    };

    git.Clone('git@bitbucket.org:' + repoFullName + '.git', '/tmp/' + repoName, options)
        .then(function(repository) {
            console.log("Cloned repository");

            zipRepository(repoName, function() {
                uploadFileToS3(repoName, context);
            });
        })
        .catch(function(ex) {
            console.log('Error cloning repo. ' + ex);
            context.done(null, 'FAILURE');
        });
}

zipRepository = function(repoName, callback) {
    var archive = archiver('zip');
    var output = fs.createWriteStream('/tmp/' + repoName + '.zip');
    archive.pipe(output);
    archive.directory('/tmp/' + repoName + '/', '').finalize();

    output.on('close', function () {
        console.log('Created zip file: /tmp/' + repoName + '.zip');
        callback();
    });
}

uploadFileToS3 = function(repoName, context) {
    fs.readFile(
        '/tmp/' + repoName + '.zip',
        function (error, data) {
            if (error) {
                console.log('Error reading source code zip file: ' + error);

                deleteTemporaryFiles(repoName, function() {
                    context.done(null, 'FAILURE');
                });                            
            }
            else {
                var s3 = new aws.S3();
                s3.putObject({
                    Bucket: 'joel-kane-bitbucket-source',
                    Key: repoName + '.zip',
                    Body: data
                }, function (error, data) {
                    if (error) {
                        console.log('Error adding file to S3: ' + error);

                        deleteTemporaryFiles(repoName, function() {
                            context.done(null, 'FAILURE');
                        });
                    }
                    else {
                        console.log('Successfully uploaded source.');

                        deleteTemporaryFiles(repoName, function() {
                            context.succeed();
                        });
                    }
                });
            }
        });
}

deleteTemporaryFiles = function(repoName, callback) {
    fs.unlinkSync('/tmp/' + repoName + '.zip');

    rimraf('/tmp/' + repoName, function() {
        if (error) {
            console.log('Error deleting folder: ' + error);
        }

        callback();
    });
}