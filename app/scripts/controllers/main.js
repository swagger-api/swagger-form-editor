'use strict';

app.controller('MainCtrl', function ($scope, $http, $filter, $timeout) {
  $scope.items = ['/path1', '/path2'];
  $scope.file = null;
  $scope.fileContents = "";
  $http.get('/data/pet-data.json').success(function(data) {
    $scope.file = data;
    fileObjectChanged();
  });

  //listen for changes from ng-model in the rows on the left panel of the view
  $scope.$watch('file', function(newValue, oldValue) {
    fileObjectChanged();
  }, true);

  var fileObjectChanged = function() {
    $scope.fileContents = $filter('json')($scope.file);
  };

//  $timeout(function() {
//    window.swagger = new SwaggerApi({
//      url: "http://petstore.swagger.wordnik.com/api/api-docs",
//      success: function () {
//        if (swagger.ready === true) {
//          // upon connect, fetch a pet and set contents to element "mydata"
////          swagger.apis.pet.getPetById({petId: 1}, function (data) {
////            console.log(data.content.data);
////          });
//          console.log(swagger);
//        }
//      }
//    });
//  }, 1000);
});
