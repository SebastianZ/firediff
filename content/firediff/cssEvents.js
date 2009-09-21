/* See license.txt for terms of usage */
FireDiff  = FireDiff || {};

FBL.ns(function() { with (FBL) {

var i18n = document.getElementById("strings_firediff");

var Path = FireDiff.Path,
  Reps = FireDiff.reps,
  CSSModel = FireDiff.CSSModel,
  ChangeEvent = FireDiff.events.ChangeEvent,
  
  CHANGES = FireDiff.events.AnnotateAttrs.CHANGES,
  REMOVE_CHANGES = FireDiff.events.AnnotateAttrs.REMOVE_CHANGES;

function CSSChangeEvent(style, changeSource, xpath) {
    ChangeEvent.call(this, changeSource);
    
    this.style = style;
    this.xpath = xpath || Path.getStylePath(style);
}
CSSChangeEvent.prototype = extend(ChangeEvent.prototype, {
    changeType: "CSS",

    getXpath: function(target) { return Path.getStylePath(target); },
    xpathLookup: function(xpath, root) {
      return Path.evaluateStylePath(xpath, root);
    },
    sameFile: function(target) {
      return target && Path.getTopPath(target.xpath) == Path.getTopPath(this.xpath);
    },
    getSnapshotRep: function(context) {
      return new Reps.CSSSnapshot(this, context);
    }
});

function CSSRuleEvent(style, changeSource, xpath, clone) {
  CSSChangeEvent.call(this, style, changeSource, xpath);
  
  this.clone = clone || CSSModel.cloneCSSObject(style);
}
CSSRuleEvent.prototype = extend(CSSChangeEvent.prototype, {
  // This is a little bit of a hack. The rule editor does not always have a
  // valid rep object and as a consequence we can't key on the target.
  //
  // Since rule insert and remove events always come from Firebug we assume
  // that this change applies to the current editor
  appliesTo: function(target) { return target; },

  mergeRevert: function(candidate) {
    if (Path.isChildOrSelf(this.xpath, candidate.xpath)
        && this.subType != candidate.subType) {
      return this.merge(candidate);
    }
  }
});

function CSSInsertRuleEvent(style, changeSource, xpath, clone) {
  CSSRuleEvent.call(this, style, changeSource, xpath, clone);
}
CSSInsertRuleEvent.prototype = extend(CSSRuleEvent.prototype, {
  subType: "insertRule",
  getSummary: function() {
    return i18n.getString("summary.CSSInsertRule");
  },
  isElementAdded: function() { return true; },

  annotateTree: function(tree, root) {
    var parent = this.getInsertActionNode(tree, root).parent;
    var identifier = Path.getIdentifier(this.xpath);
    
    if (!parent && FBTrace.DBG_ERRORS) {
      FBTrace.sysout("CSSRuleEvent.annotateTree: Failed to lookup parent " + this.xpath + " " + root, tree);
    }
    var rule = parent.cssRules[identifier.index-1];
    rule[CHANGES] = this;
    rule.xpath = this.xpath;
    return rule;
  },
  merge: function(candidate) {
    if (candidate.subType == "removeRule"
        && this.xpath == candidate.xpath) {
      return this.clone.equals(candidate.clone) ? [] : undefined;
    }
    
    var updateXpath = candidate.getMergedXPath(this);
    if (updateXpath) {
      return [
          this.cloneOnXPath(updateXpath),
          candidate
        ];
    } else if (Path.isChildOrSelf(this.xpath, candidate.xpath)
        && (candidate.subType == "setProp" || candidate.subType == "removeProp")){
      // TODO : Handle @media nested changes?
      var clone = this.clone.clone();
      candidate.apply(clone, this.xpath);
      
      return [ new CSSInsertRuleEvent(this.style, this.changeSource, this.xpath, clone) ];
    }
  },
  isCancellation: function(candidate) {
    return candidate.isElementRemoved()
        && this.xpath == candidate.xpath;
  },
  affectsCancellation: function(candidate) {
    return Path.isChildOrSelf(this.xpath, candidate.xpath);
  },
  cloneOnXPath: function(xpath) {
    return new CSSInsertRuleEvent(this.style, this.changeSource, xpath, this.clone);
  },
  
  apply: function(style, xpath) {
    Firebug.DiffModule.ignoreChanges(bindFixed(
        function() {
          var actionNode = this.getInsertActionNode(style, xpath);
          var identifier = Path.getIdentifier(this.xpath);
          identifier.index--;
          
          if (actionNode.parent instanceof CSSStyleSheet
              || actionNode.parent instanceof CSSMediaRule) {
            Firebug.CSSModule.insertRule(actionNode.parent, this.clone.cssText, identifier.index);
          } else {
            actionNode.parent.cssRules.splice(identifier.index, 0, CSSModel.cloneCSSObject(this.clone));
          }
        }, this));
  },
  revert: function(style, xpath) {
    Firebug.DiffModule.ignoreChanges(bindFixed(
        function() {
          var actionNode = this.getInsertActionNode(style, xpath);
          var identifier = Path.getIdentifier(this.xpath);
          identifier.index--;
          
          if (actionNode.parent instanceof CSSStyleSheet
              || actionNode.parent instanceof CSSMediaRule) {
            Firebug.CSSModule.deleteRule(actionNode.parent, identifier.index);
          } else {
            actionNode.parent.cssRules.splice(identifier.index, 1);
          }
        }, this));
  }
});

function CSSRemoveRuleEvent(style, changeSource, xpath, clone, styleSheet) {
  CSSRuleEvent.call(this, style, changeSource, xpath, clone);
  this.styleSheet = styleSheet || style.parentStyleSheet;
}
CSSRemoveRuleEvent.prototype = extend(CSSRuleEvent.prototype, {
  subType: "removeRule",
  getSummary: function() {
    return i18n.getString("summary.CSSRemoveRule");
  },
  isElementRemoved: function() { return true; },

  annotateTree: function(tree, root) {
    var actionNode = this.getInsertActionNode(tree, root).parent;
    var list = actionNode[REMOVE_CHANGES] || [];
    list.push(this);
    actionNode[REMOVE_CHANGES] = list;
    // TODO : Verify this is UTed
    actionNode.xpath = this.xpath;
    
    return this;
  },
  merge: function(candidate) {
    if (candidate.subType == "insertRule"
        && this.xpath == candidate.xpath) {
      if (this.clone.equals(candidate.clone)) {
        return [];
      } else {
        return [this, candidate];
      }
    }
    
    var updateXpath = candidate.getMergedXPath(this);
    if (updateXpath) {
      return [
          this.cloneOnXPath(updateXpath),
          candidate
        ];
    } else if (this.xpath == candidate.xpath
        && (this.subType == "setProp" || this.subType == "removeProp")){
      // TODO : Handle @media nested changes?
      // TODO : Unit test this path
      // TODO : Why exactly are we modifying a remove event?
      var clone = this.clone.clone();
      candidate.apply(clone, this.xpath);
      
      return [ new CSSRemoveRuleEvent(this.style, this.changeSource, this.xpath, clone, this.styleSheet) ];
    }
  },
  mergeRevert: function(candidate) {
    if (this.isCancellation(candidate)) {
      return [];
    }
  },
  isCancellation: function(candidate) {
    return this.xpath == candidate.xpath
        && candidate.isElementAdded()
        && this.clone.equals(candidate.clone);
  },
  affectsCancellation: function(candidate) {
    return this.isCancellation(candidate);
  },
  cloneOnXPath: function(xpath) {
    return new CSSRemoveRuleEvent(this.style, this.changeSource, xpath, this.clone, this.styleSheet);
  },
  
  apply: CSSInsertRuleEvent.prototype.revert,
  revert: CSSInsertRuleEvent.prototype.apply
});

function CSSPropChangeEvent(style, propName, changeSource, xpath) {
  CSSChangeEvent.call(this, style, changeSource, xpath);
  
  this.propName = propName;
}
CSSPropChangeEvent.prototype = extend(CSSChangeEvent.prototype, {
  annotateTree: function(tree, root) {
    var parent = this.getActionNode(tree, root);
    
    if (!parent && FBTrace.DBG_ERRORS) {
      FBTrace.sysout("CSSRuleEvent.annotateTree: Failed to lookup parent " + this.xpath, tree);
    }
    var changes = parent.propChanges || [];
    changes.push(this);
    parent.propChanges = changes;
    parent.xpath = this.xpath;
    return parent;
  },
  
  merge: function(candidate) {
    if (candidate.subType == "removeRule"
        && this.xpath == candidate.xpath) {
      return [undefined, candidate];
    }
    
    var updateXpath = candidate.getMergedXPath(this);
    if (updateXpath) {
      return [
          this.cloneOnXPath(updateXpath),
          candidate
        ];
    }
      if (this.changeType != candidate.changeType
              || this.xpath != candidate.xpath
              || this.propName != candidate.propName) {
          return undefined;
      }
      
      return this.mergeSubtype(candidate);
  },
  mergeRevert: function(candidate) {
    if (this.xpath == candidate.xpath
        && this.propName == candidate.propName) {
      return this.merge(candidate);
    }
  },
  affectsCancellation: function(candidate) {
    return this.xpath == candidate.xpath
        && this.propName == candidate.propName;
  }
});

function CSSSetPropertyEvent(style, propName, propValue, propPriority, prevValue, prevPriority, changeSource, xpath) {
  CSSPropChangeEvent.call(this, style, propName, changeSource, xpath);
  
  this.propValue = propValue;
  this.propPriority = propPriority;
  this.prevValue = prevValue;
  this.prevPriority = prevPriority;
}
CSSSetPropertyEvent.prototype = extend(CSSPropChangeEvent.prototype, {
    subType: "setProp",
    
    getSummary: function() {
        return i18n.getString("summary.CSSSetProperty");
    },
    mergeSubtype: function(candidate) {
      if (this.subType == candidate.subType) {
        if (this.prevValue != candidate.propValue
            || this.prevPriority != candidate.propPriority) {
          return [
              new CSSSetPropertyEvent(
                      this.style, this.propName,
                      candidate.propValue, candidate.propPriority,
                      this.prevValue, this.prevPriority, this.changeSource,
                      this.xpath)
              ];
        } else {
          return [];
        }
      } else if (candidate.subType == "removeProp"){
        if (this.prevValue != candidate.propValue
            || this.prevPriority != candidate.propPriority) {
          return [
              new CSSRemovePropertyEvent(
                      this.style, this.propName,
                      this.prevValue, this.prevPriority,
                      this.changeSource, this.xpath)
              ];
        } else {
          return [];
        }
      }
    },
    isCancellation: function(candidate) {
      return this.xpath == candidate.xpath
          && this.prevValue == candidate.propValue
          && this.prevPriority == candidate.propPriority;
    },
    cloneOnXPath: function(xpath) {
      return new CSSSetPropertyEvent(
          this.style, this.propName,
          this.propValue, this.propPriority,
          this.prevValue, this.prevPriority,
          this.changeSource,
          xpath);
    },
    
    apply: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            Firebug.CSSModule.setProperty(actionNode.style, this.propName, this.propValue, this.propPriority);
          }, this));
    },
    revert: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            if (this.prevValue) {
              Firebug.CSSModule.setProperty(actionNode.style, this.propName, this.prevValue, this.prevPriority);
            } else {
              Firebug.CSSModule.removeProperty(actionNode.style, this.propName);
            }
          }, this));
    }
});

function CSSRemovePropertyEvent(style, propName, prevValue, prevPriority, changeSource, xpath) {
  CSSPropChangeEvent.call(this, style, propName, changeSource, xpath);

  // Seed empty values for the current state. This makes the domplate
  // display much easier
  this.propValue = "";
  this.propPriority = "";
  
  this.prevValue = prevValue;
  this.prevPriority = prevPriority;
}
CSSRemovePropertyEvent.prototype = extend(CSSPropChangeEvent.prototype, {
    subType: "removeProp",
    
    getSummary: function() {
        return i18n.getString("summary.CSSRemoveProperty");
    },
    mergeSubtype: function(candidate) {
      if (this.subType == candidate.subType) {
        return [this];
      } else if (candidate.subType == "setProp") {
        if (this.prevValue == candidate.propValue
            && this.prevProperty == candidate.propProperty) {
          return [];
        }

        return [
                new CSSSetPropertyEvent(
                        this.style, this.propName,
                        candidate.propValue, candidate.propPriority,
                        this.prevValue, this.prevPriority, this.changeSource,
                        this.xpath)
                ];
      }
    },
    isCancellation: function(candidate) {
      return this.xpath == candidate.xpath
          && this.subType != candidate.subType
          && this.prevValue == candidate.propValue
          && this.prevPriority == candidate.propPriority;
    },
    cloneOnXPath: function(xpath) {
      return new CSSRemovePropertyEvent(
          this.style, this.propName,
          this.prevValue, this.prevPriority,
          this.changeSource,
          xpath);
    },
    apply: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            Firebug.CSSModule.removeProperty(actionNode.style, this.propName);
          }, this));
    },
    revert: function(style, xpath) {
      Firebug.DiffModule.ignoreChanges(bindFixed(
          function() {
            var actionNode = this.getActionNode(style, xpath);
            Firebug.CSSModule.setProperty(actionNode.style, this.propName, this.prevValue, this.prevPriority);
          }, this));
    }
});

FireDiff.events.css = {
  CSSInsertRuleEvent: CSSInsertRuleEvent,
  CSSRemoveRuleEvent: CSSRemoveRuleEvent,
  CSSSetPropertyEvent: CSSSetPropertyEvent,
  CSSRemovePropertyEvent: CSSRemovePropertyEvent
};

}});