angular.module('swaggerEditorApp').factory('WorkspaceService', function (ProjectService, localStorageService, $timeout) {

  var service = {
    project: null,
    history: (function() {
      var history = localStorageService.get('swagger.history');
      if (!history || history.length == 0) {
        var timestamp = Date.now();
        history = [{
          url: "http://petstore.swagger.wordnik.com/api/api-docs",
          project: null,
          created: timestamp,
          modified: timestamp
        }];
     }
      return history;
    })(),

    projectIndexInHistory: function(url) {
      var historyIndex = null;

      service.history.forEach(function(project, index) {
        if (project.url == url) {
          historyIndex = index;
        }
      });

      return historyIndex;
    },

    clickNew: function() {
      ProjectService.close();
      ProjectService.newDoc();
      service.project = ProjectService.doc;
    },

    close: function() {
      ProjectService.close();
      service.project = null;
    },

    clickDelete: function() {
      var historyIndex = service.projectIndexInHistory(ProjectService.remoteURL);

      if (historyIndex != null) {
        service.history.splice(historyIndex, 1);
        localStorageService.set('swagger.history', service.history);
      }
      service.close();
    },

    openFromHistory: function(index) {
      console.log("opening from history");
      console.log(service.history[index]);
      var url = service.history[index].url;

      //if reference to saved project, load in memory
      if (service.history[index].project) {
        ProjectService.openDoc(url, service.history[index].project);
        service.project = ProjectService.doc;
      //if it's just a reference to an external url, import it again
      } else {
        ProjectService.importAndOpenDocFromURL(url, function(doc) {
          service.project = ProjectService.doc;
        });
      }
    },

    clickOpenFromURL: function() {
      var url = prompt("Please enter new url", "");

      if (url) {
        var historyIndex = service.projectIndexInHistory(url);

        if (historyIndex == null) {
          ProjectService.importAndOpenDocFromURL(url, function(doc) {
            service.project = doc;
            var timestamp = Date.now();

            ProjectService.history.unshift({
              url: url,
              project: null,
              created: timestamp,
              modified: timestamp
            });
            localStorageService.set('swagger.history', service.history);
          });
        } else {
          service.openFromHistory(historyIndex);
        }
      }
    },

    openMostRecentProject: function() {
      if (service.history.length > 0) {
        service.openFromHistory(0);
      }
    },

    clickSaveCurrentProject: function() {
      if (ProjectService.doc.apiDeclarations.length == 0) {
        alert("You must create at least one resource to save the project.");
        return;
      }

      var historyIndex = service.projectIndexInHistory(ProjectService.remoteURL);

      if (historyIndex == null || service.history[historyIndex].project == null) {
        service.clickSaveCurrentProjectAs();
        return;
      }

      //save as most recent, delete original one
      service.history.unshift({
        url: service.history[historyIndex].url,
        project: ProjectService.exportDoc(ProjectService.doc),
        created: service.history[historyIndex].created,
        modified: Date.now()
      });

      service.history.splice(historyIndex + 1, 1);
      localStorageService.set('swagger.history', service.history);

    },

    clickSaveCurrentProjectAs: function() {
      if (ProjectService.doc.apiDeclarations.length == 0) {
        alert("You must create at least one resource to save the project.");
        return;
      }

      var requestedName = prompt("[Save As] Please enter a name to save the project locally, or click Cancel.", "My Project");

      while (requestedName) {
        var historyIndex = service.projectIndexInHistory(requestedName);

        if (historyIndex == null) {
          //save as most recent, open it
          var timestamp = Date.now();

          service.history.unshift({
            url: requestedName,
            project: ProjectService.exportDoc(ProjectService.doc),
            created: timestamp,
            modified: timestamp
          });
          localStorageService.set('swagger.history', service.history);

          service.openMostRecentProject();
          requestedName = null;
        } else {
          requestedName = prompt("[Save As] Sorry, this name is already taken.  Please enter name to save the project locally, or click Cancel.", requestedName);
        }
      }
    }
  };

  return service;
});
