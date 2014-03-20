'use strict';

app.controller('MainCtrl', function ($scope, $http) {
  $scope.items = ['/path1', '/path2'];
  $http.get('/data/pet-data.json').success(function(data) {
    console.log(data);
    $scope.fileContents = data;

  });

//  window.swagger = new SwaggerApi({
//    url: "http://petstore.swagger.wordnik.com/api/api-docs.json",
//    success: function() {
//      if(swagger.ready === true) {
//        // upon connect, fetch a pet and set contents to element "mydata"
//        swagger.apis.pet.getPetById({petId:1}, function(data) {
//          console.log(data.content.data);
//        });
//      }
//    }
//  });
});
