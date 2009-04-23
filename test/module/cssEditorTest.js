function runTest() {
  var Events = FBTest.FirebugWindow.FireDiff.events,
    Firebug = FBTest.FirebugWindow.Firebug,
    FBTrace = FBTest.FirebugWindow.FBTrace;
  var cssPanel;
  
  FBTest.loadScript("FBTestFireDiff.js", this);
  
  function setEditorValue(editor, value) {
    var editorInput = editor.input;
    editorInput.value = value;
    Firebug.Editor.update(true);
  }
  function resetCSS(win) {
    var style = win.document.getElementsByTagName("style")[0];
    var rules = style.sheet.cssRules;
    for (var i = 0; i < rules.length; i++) {
      FBTrace.sysout("style " + i + " " + rules[i].cssText, rules[i]);
    }
    style.innerHTML = "#insertNode {background-color: green;}";
    cssPanel.updateLocation(style.sheet);
  }
  
  var tests = [
    {
      name: "newProperty",
      setup: resetCSS,
      execute: function(win) {
        var panelNode = cssPanel.panelNode;
        var rule = panelNode.getElementsByClassName("cssRule")[0];
        
        cssPanel.insertPropertyRow(rule);
        
        var editor = cssPanel.editor;
        setEditorValue(editor, "whitespace");
        setEditorValue(editor, "display");
        Firebug.Editor.tabNextEditor();
        
        setEditorValue(editor, "inline");
        setEditorValue(editor, "block");
        Firebug.Editor.stopEditing();
      },
      verify: function(win, number, change) {
        FBTest.compare(change.changeSource, Events.ChangeSource.FIREBUG_CHANGE, "Change source: " + change.changeSource);
        FBTest.compare(change.changeType, "CSS", "Change type: " + change.changeType);
        FBTest.compare(change.subType, "setProp", "Sub type: " + change.subType);
        FBTest.compare(change.propName, "display", "Prop Name: " + change.propName);
        FBTest.compare(change.propValue, "block", "Prop Value: " + change.propValue);
        FBTest.compare(change.propPriority, "", "Prop Priority: " + change.propPriority);
        FBTest.compare(change.prevValue, "", "Prev Value: " + change.prevValue);
        FBTest.compare(change.prevPriority, "", "Prev Priority: " + change.prevPriority);
      },
      eventCount: 1
    },
    {
      name: "editProperty",
      setup: resetCSS,
      execute: function(win) {
        var panelNode = cssPanel.panelNode;
        var rule = panelNode.getElementsByClassName("cssPropValue")[0];
        
        Firebug.Editor.startEditing(rule, rule.textContent);
        
        var editor = cssPanel.editor;
        setEditorValue(editor, "yellow");
        setEditorValue(editor, "blue !important");
        Firebug.Editor.stopEditing();
      },
      verify: function(win, number, change) {
        FBTest.compare(change.changeSource, Events.ChangeSource.FIREBUG_CHANGE, "Change source: " + change.changeSource);
        FBTest.compare(change.changeType, "CSS", "Change type: " + change.changeType);
        FBTest.compare(change.subType, "setProp", "Sub type: " + change.subType);
        FBTest.compare(change.propName, "background-color", "Prop Name: " + change.propName);
        FBTest.compare(change.propValue, "blue", "Prop Value: " + change.propValue);
        FBTest.compare(change.propPriority, "important", "Prop Priority: " + change.propPriority);
        FBTest.compare(change.prevValue, "green", "Prev Value: " + change.prevValue);
        FBTest.compare(change.prevPriority, "", "Prev Priority: " + change.prevPriority);
      },
      eventCount: 1
    },
    {
      name: "renameProperty",
      setup: resetCSS,
      execute: function(win) {
        var panelNode = cssPanel.panelNode;
        var rule = panelNode.getElementsByClassName("cssPropName")[0];
        
        Firebug.Editor.startEditing(rule, rule.textContent);
        
        var editor = cssPanel.editor;
        setEditorValue(editor, "border-color");
        setEditorValue(editor, "color");
        Firebug.Editor.stopEditing();
      },
      verify: function(win, number, change) {
        FBTest.compare(change.changeSource, Events.ChangeSource.FIREBUG_CHANGE, "Change source: " + change.changeSource);
        FBTest.compare(change.changeType, "CSS", "Change type: " + change.changeType);
        FBTest.compare(change.subType, number ? "setProp" : "removeProp", "Sub type: " + change.subType);
        FBTest.compare(change.propName, number ? "color" : "background-color", "Prop Name: " + change.propName);
        FBTest.compare(change.propValue, number ? "green" : "", "Prop Value: " + change.propValue);
        FBTest.compare(change.propPriority, "", "Prop Priority: " + change.propPriority);
        FBTest.compare(change.prevValue, number ? "" : "green", "Prev Value: " + change.prevValue);
        FBTest.compare(change.prevPriority, "", "Prev Priority: " + change.prevPriority);
      },
      eventCount: 2
    },
    {
      name: "deleteProperty_name",
      setup: resetCSS,
      execute: function(win) {
        var panelNode = cssPanel.panelNode;
        var rule = panelNode.getElementsByClassName("cssPropName")[0];
        
        Firebug.Editor.startEditing(rule, rule.textContent);
        
        var editor = cssPanel.editor;
        setEditorValue(editor, "border-color");
        setEditorValue(editor, "");
        Firebug.Editor.stopEditing();
      },
      verify: function(win, number, change) {
        FBTest.compare(change.changeSource, Events.ChangeSource.FIREBUG_CHANGE, "Change source: " + change.changeSource);
        FBTest.compare(change.changeType, "CSS", "Change type: " + change.changeType);
        FBTest.compare(change.subType, "removeProp", "Sub type: " + change.subType);
        FBTest.compare(change.propName, "background-color", "Prop Name: " + change.propName);
        FBTest.compare(change.propValue, "", "Prop Value: " + change.propValue);
        FBTest.compare(change.propPriority, "", "Prop Priority: " + change.propPriority);
        FBTest.compare(change.prevValue, "green", "Prev Value: " + change.prevValue);
        FBTest.compare(change.prevPriority, "", "Prev Priority: " + change.prevPriority);
      },
      eventCount: 1
    },
    {
      name: "deleteProperty_value",
      setup: resetCSS,
      execute: function(win) {
        var panelNode = cssPanel.panelNode;
        var rule = panelNode.getElementsByClassName("cssPropValue")[0];
        
        Firebug.Editor.startEditing(rule, rule.textContent);
        
        var editor = cssPanel.editor;
        setEditorValue(editor, "black");
        setEditorValue(editor, "");
        Firebug.Editor.stopEditing();
      },
      verify: function(win, number, change) {
        FBTest.compare(change.changeSource, Events.ChangeSource.FIREBUG_CHANGE, "Change source: " + change.changeSource);
        FBTest.compare(change.changeType, "CSS", "Change type: " + change.changeType);
        FBTest.compare(change.subType, "removeProp", "Sub type: " + change.subType);
        FBTest.compare(change.propName, "background-color", "Prop Name: " + change.propName);
        FBTest.compare(change.propValue, "", "Prop Value: " + change.propValue);
        FBTest.compare(change.propPriority, "", "Prop Priority: " + change.propPriority);
        FBTest.compare(change.prevValue, "green", "Prev Value: " + change.prevValue);
        FBTest.compare(change.prevPriority, "", "Prev Priority: " + change.prevPriority);
      },
      eventCount: 1
    },
    {
      name: "deleteProperty_menu",
      setup: resetCSS,
      execute: function(win) {
        var panelNode = cssPanel.panelNode;
        var rule = panelNode.getElementsByClassName("cssProp")[0];
        
        cssPanel.deletePropertyRow(rule);
      },
      verify: function(win, number, change) {
        FBTest.compare(change.changeSource, Events.ChangeSource.FIREBUG_CHANGE, "Change source: " + change.changeSource);
        FBTest.compare(change.changeType, "CSS", "Change type: " + change.changeType);
        FBTest.compare(change.subType, "removeProp", "Sub type: " + change.subType);
        FBTest.compare(change.propName, "background-color", "Prop Name: " + change.propName);
        FBTest.compare(change.propValue, "", "Prop Value: " + change.propValue);
        FBTest.compare(change.propPriority, "", "Prop Priority: " + change.propPriority);
        FBTest.compare(change.prevValue, "green", "Prev Value: " + change.prevValue);
        FBTest.compare(change.prevPriority, "", "Prev Priority: " + change.prevPriority);
      },
      eventCount: 1
    },
    {
      name: "disableProperty",
      setup: resetCSS,
      execute: function(win) {
        var panelNode = cssPanel.panelNode;
        var rule = panelNode.getElementsByClassName("cssProp")[0];
        
        cssPanel.disablePropertyRow(rule);
        cssPanel.disablePropertyRow(rule);
      },
      verify: function(win, number, change) {
        FBTest.compare(change.changeSource, Events.ChangeSource.FIREBUG_CHANGE, "Change source: " + change.changeSource);
        FBTest.compare(change.changeType, "CSS", "Change type: " + change.changeType);
        FBTest.compare(change.subType, number ? "setProp" : "removeProp", "Sub type: " + change.subType);
        FBTest.compare(change.propName, "background-color", "Prop Name: " + change.propName);
        FBTest.compare(change.propValue, number ? "green" : "", "Prop Value: " + change.propValue);
        FBTest.compare(change.propPriority, "", "Prop Priority: " + change.propPriority);
        FBTest.compare(change.prevValue, number ? "" : "green", "Prev Value: " + change.prevValue);
        FBTest.compare(change.prevPriority, "", "Prev Priority: " + change.prevPriority);
      },
      eventCount: 2
    }
    
    // TODO : Tests
    // CSS Free edit
  ];
  
  var urlBase = FBTest.getHTTPURLBase();
  FBTestFirebug.openNewTab(urlBase + "module/index.htm", function(win) {
    FBTestFirebug.openFirebug();
    
    FBTestFirebug.selectPanel("stylesheet");
    cssPanel = FBTestFirebug.getSelectedPanel();
    cssPanel.select();
    
    FBTestFireDiff.executeModuleTests(tests, win);
  });
}