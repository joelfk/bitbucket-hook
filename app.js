var git = require('nodegit');

git.Clone("https://github.com/joelfk/nodegit-test", "nodegit-test")
    .then(function(repository) {
        repository.getBranchCommit("origin/develop")
            .then(function(commit) {
                repository.createBranch('develop', commit, true)
                    .then(function(reference) {
                        repository.checkoutRef(reference)
                            .then(function() {
                                console.log("Done");
                            })
                            .catch(function(ex) {
                                console.log("Error checking out reference." + ex);
                            })
                    })
                    .catch(function(ex) {
                        console.log("Error creating branch. " + ex);
                    })
            })
            .catch(function(ex) {
                console.log("Error getting commit. " + ex);
            });
    })
    .catch(function(ex) {
        console.log("Error cloning repo. " + ex);
    });