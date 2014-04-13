angular.module('swaggerEditorApp').factory('WorkspaceService', function (ProjectService, $timeout) {

  var service = {
    project: null,

    new: function() {
      ProjectService.close(service.project);
      ProjectService.new(service.project);
    },
    close: function() {
      ProjectService.close(service.project);
    },
    openProject: function(url) {
      ProjectService.close(service.project);
      ProjectService.importDocFromURL(url, service.project);
    }
  };

  return service;
});
