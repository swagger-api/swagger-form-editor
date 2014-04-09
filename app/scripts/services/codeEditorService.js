angular.module('swaggerEditorApp').factory('CodeEditorService', function (ProjectUtilities, $timeout) {

  var service = {
    highlightBlocksInFile: function(file, editor) {
      console.log("HIGHLIGHT OPEN BLOCKS");
      //clear existing markers
      for (var markerID in editor.getSession().getMarkers()) {
        editor.getSession().removeMarker(markerID);
      }

      ProjectUtilities.forEachItemInFile(file, {
        operation: function (op, opIndex, ops, api) {
          if (op.__open) {
            service.highlightBlock(
              '"path": "' + api.path + '"',
              '"method": "' + op.method + '"',
              editor
            );
          }
        }
      });
    },

    highlightBlock: function(parentSelector, blockSelector, editor) {
      $timeout(function() {
        if (editor) {
          //      console.log("HIGHLIGHT BLOCK");
          var aceSearch = ace.require('ace/search').Search;
          var aceRange = ace.require('ace/range').Range;

          var range;

          //find and highlight the parent selector
          var search = new aceSearch().set({needle: parentSelector});
          range = search.find(editor.getSession());
          //      editor.getSession().addMarker(range, "ace_active-line", "fullLine");
          //      console.log(range);
          //      console.log(blockSelector);

          //find and highlight the block
          var search = new aceSearch().set({needle: blockSelector, start: range.start});
          //      {wholeWord: true, wrap: false, range: {start: range.start, end: {row: 200, column: 0}}
          range = search.find(editor.getSession());
          //      console.log(range);
          editor.gotoLine(range.start.row + 1, 0);
          var cursor = editor.getCursorPosition();

          range = editor.find({
            needle: /[({})\[\]]/g,
            preventScroll: true,
            backwards: true,
            start: {row: cursor.row, column: cursor.column - 1 }
          });

          var matching = editor.session.findMatchingBracket(range.end);

          if (aceRange.comparePoints(matching, range.end) > 0) {
            range.end = matching;
            range.end.column++;
          } else {
            range.start = matching;
          }

          editor.getSession().addMarker(range, "ace_active-line", "fullLine");
          editor.scrollToLine(range.start.row - 2);
        }
      }, 0);

    }
  };

  return service;
});