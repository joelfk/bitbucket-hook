// Bitbucket Server v4.9.1 

var git = require('nodegit');
var archiver = require('archiver');
var fs = require('fs');
var aws = require('aws-sdk');
var rimraf = require("rimraf");

exports.myHandler = function(event, context) {
    var projectKey = event.repository.project.key;
    var repoName = event.repository.name;
    var fullBranchName = event.refChanges[0].refId;
    var branchName = fullBranchName.substring('refs/heads/'.length);

    cloneRepo(projectKey, repoName, branchName, context);
}

cloneRepo = function(projectKey, repoName, branchName, context) {
    var options = {
        checkoutBranch: branchName,
        fetchOpts: {
            callbacks: {
                certificateCheck: function() {
                    return 1;
                },
                credentials: function(url, userName) {
                    console.log('Url: ' + url + '. Username: ' + userName);
                    return git.Cred.sshKeyNew(
                        userName,
                        'bedev.pub',
                        'bedev',
                        '');
                }
            }
        }
    };

    git.Clone('ssh://git@stash.aws.beteasy.com.au:7999/' + projectKey + '/' + repoName + '.git', '/tmp/' + repoName, options)
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