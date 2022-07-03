(function ($hx_exports, $global) { "use strict";
var ArrayHelper = function() { };
ArrayHelper.moveToStart = function(array,f) {
	var element = Lambda.find(array,f);
	if(element != null) {
		HxOverrides.remove(array,element);
		array.unshift(element);
	}
};
var DisplayArgsProvider = function(api,activationChangedCallback) {
	this.description = "Project using ZYHeaps command-line tools";
	this.api = api;
	this.activationChangedCallback = activationChangedCallback;
};
DisplayArgsProvider.prototype = {
	activate: function(provideArguments) {
		this.updateArgumentsCallback = provideArguments;
		if(this.parsedArguments != null) {
			this.updateArguments();
		}
		this.activationChangedCallback(true);
	}
	,deactivate: function() {
		this.updateArgumentsCallback = null;
		this.activationChangedCallback(false);
	}
	,update: function($arguments) {
		if(this.arguments != $arguments && this.api != null) {
			this.arguments = $arguments;
			this.parsedArguments = this.api.parseHxmlToArguments($arguments);
			this.updateArguments();
		}
	}
	,updateArguments: function() {
		if(this.updateArgumentsCallback != null) {
			this.updateArgumentsCallback(this.parsedArguments);
		}
	}
};
var HxOverrides = function() { };
HxOverrides.cca = function(s,index) {
	var x = s.charCodeAt(index);
	if(x != x) {
		return undefined;
	}
	return x;
};
HxOverrides.substr = function(s,pos,len) {
	if(len == null) {
		len = s.length;
	} else if(len < 0) {
		if(pos == 0) {
			len = s.length + len;
		} else {
			return "";
		}
	}
	return s.substr(pos,len);
};
HxOverrides.remove = function(a,obj) {
	var i = a.indexOf(obj);
	if(i == -1) {
		return false;
	}
	a.splice(i,1);
	return true;
};
HxOverrides.now = function() {
	return Date.now();
};
var Lambda = function() { };
Lambda.find = function(it,f) {
	var v = $getIterator(it);
	while(v.hasNext()) {
		var v1 = v.next();
		if(f(v1)) {
			return v1;
		}
	}
	return null;
};
var Main = function(context) {
	this.disposables = [];
	this.isProjectFileDirty = false;
	this.context = context;
	this.registerDebugConfigurationProviders();
	context.subscriptions.push(Vscode.workspace.onDidChangeConfiguration($bind(this,this.workspace_onDidChangeConfiguration)));
	this.refresh();
};
Main.main = function() {
};
Main.activate = $hx_exports["activate"] = function(context) {
	Main.instance = new Main(context);
};
Main.deactivate = $hx_exports["deactivate"] = function() {
	Main.instance.deconstruct();
};
Main.prototype = {
	workspace_onDidChangeConfiguration: function(_) {
		this.refresh();
	}
	,refresh: function() {
		if(!this.initialized) {
			this.initialize();
			this.construct();
		}
		this.updateHaxeEnvironment();
		if(this.displayArgumentsProvider == null) {
			this.constructDisplayArgumentsProvider();
		}
	}
	,deconstruct: function() {
		var _g = 0;
		var _g1 = this.disposables;
		while(_g < _g1.length) _g1[_g++].dispose();
		this.selectTargetItem = null;
		this.editTargetFlagsItem = null;
		this.isProjectFileDirty = false;
		this.disposables = [];
		this.initialized = false;
	}
	,initialize: function() {
		this.initialized = true;
		this.targetItems = [];
		var _g = 0;
		var _g1 = SupportPlatform.list;
		while(_g < _g1.length) {
			var item = _g1[_g];
			++_g;
			this.targetItems.push({ label : item.desc != null ? item.desc : item.name.toUpperCase(), target : item.name.toUpperCase(), args : []});
		}
	}
	,construct: function() {
		this.selectTargetItem = Vscode.window.createStatusBarItem(vscode_StatusBarAlignment.Left,9);
		this.selectTargetItem.tooltip = "Select Heaps Target Configuration";
		this.selectTargetItem.command = "heaps.selectTarget";
		this.disposables.push(this.selectTargetItem);
		this.setTargetConfiguration(this.targetItems[0]);
		this.disposables.push(Vscode.commands.registerCommand("heaps.selectTarget",$bind(this,this.selectTargetItem_onCommand)));
		this.disposables.push(Vscode.tasks.registerTaskProvider("heaps",this));
	}
	,getVshaxe: function() {
		return Vscode.extensions.getExtension("nadako.vshaxe").exports;
	}
	,constructDisplayArgumentsProvider: function() {
		var _gthis = this;
		var api = Vscode.extensions.getExtension("nadako.vshaxe").exports;
		this.displayArgumentsProvider = new DisplayArgsProvider(api,function(isProviderActive) {
			_gthis.isProviderActive = isProviderActive;
			_gthis.refresh();
		});
		if(!api) {
			console.log("src/Main.hx:111:","Warning: Haxe language server not available (using an incompatible vshaxe version)");
		} else {
			this.displayArgumentsProviderDisposable = api.registerDisplayArgumentsProvider("Hepas",this.displayArgumentsProvider);
		}
	}
	,selectTargetItem_onCommand: function() {
		var _gthis = this;
		var items = this.targetItems.slice();
		var targetItem = this.currentTargetItem;
		ArrayHelper.moveToStart(items,function(item) {
			return item == targetItem;
		});
		Vscode.window.showQuickPick(items,{ matchOnDetail : true, placeHolder : "Select Heaps Target Configuration"}).then(function(choice) {
			if(choice == null) {
				return;
			}
			_gthis.setTargetConfiguration(choice);
		});
	}
	,setTargetConfiguration: function(targetConfig) {
		var _gthis = this;
		if(this.currentTargetItem != null && this.currentTargetItem.label == targetConfig.label) {
			return;
		}
		this.currentTargetItem = targetConfig;
		this.selectTargetItem.text = this.currentTargetItem.label;
		this.selectTargetItem.show();
		js_node_ChildProcess.exec("haxelib run zyheaps hxml " + this.currentTargetItem.target.toLowerCase(),{ cwd : Vscode.workspace.workspaceFolders[0].uri.fsPath},function(err,stdout,stderror) {
			if(err != null && err.code != 0) {
				var showFullErrorLabel = "Show Full Error";
				Vscode.window.showErrorMessage("Heaps completion setup failed, Align.",showFullErrorLabel).then(function(selection) {
					if(selection == showFullErrorLabel) {
						Vscode.commands.executeCommand("workbench.action.toggleDevTools");
					}
				});
			} else {
				var hxml = stdout.toString();
				var projectDirectory = _gthis.getProjectDirectory();
				if(projectDirectory != "") {
					hxml += "\n--cwd \"" + projectDirectory + "\"";
				}
				_gthis.displayArgumentsProvider.update(hxml);
			}
		});
	}
	,getProjectDirectory: function() {
		return Vscode.workspace.workspaceFolders[0].uri.fsPath;
	}
	,editTargetFlagsItem_onCommand: function() {
	}
	,refreshCodeCompletion: function() {
	}
	,registerDebugConfigurationProviders: function() {
		Vscode.debug.registerDebugConfigurationProvider("lime",this);
	}
	,getTaskName: function(item) {
		return "Heaps build platform " + (item.desc != null ? item.desc + "[" + item.name + "]" : item.name.toUpperCase());
	}
	,provideTasks: function(token) {
		var vshaxe = Vscode.extensions.getExtension("nadako.vshaxe").exports;
		var tasks = [];
		var _g = 0;
		var _g1 = SupportPlatform.list;
		while(_g < _g1.length) {
			var item = _g1[_g];
			++_g;
			var definition = { "type" : "heaps", "command" : "haxelib run zyheaps build " + item.name, "targetConfiguration" : item.name};
			var presentation = vshaxe.taskPresentation;
			var task = this.createTask(definition,this.getTaskName(item),definition.command,[],presentation,[]);
			task.group = vscode_TaskGroup.Build;
			tasks.push(task);
			var definition1 = { "type" : "heaps", "command" : "haxelib run zyheaps build " + item.name + " -final", "targetConfiguration" : item.name};
			var presentation1 = vshaxe.taskPresentation;
			var task1 = this.createTask(definition1,this.getTaskName(item) + " (RELEASE)",definition1.command,[],presentation1,[]);
			task1.group = vscode_TaskGroup.Build;
			tasks.push(task1);
		}
		return tasks;
	}
	,resolveTask: function(task,token) {
		return task;
	}
	,updateHaxeEnvironment: function() {
		var haxeConfiguration = Vscode.extensions.getExtension("nadako.vshaxe").exports.haxeExecutable.configuration;
		var env = { };
		var _g = 0;
		var _g1 = Reflect.fields(haxeConfiguration.env);
		while(_g < _g1.length) {
			var field = _g1[_g];
			++_g;
			env[field] = haxeConfiguration.env[field];
		}
		if(!haxeConfiguration.isCommand) {
			var separator = Sys.systemName() == "Windows" ? ";" : ":";
			env["PATH"] = haxe_io_Path.directory(haxeConfiguration.executable) + separator + process.env["PATH"];
		}
		this.haxeEnvironment = env;
	}
	,createTask: function(definition,name,command,additionalArgs,presentation,problemMatchers,group) {
		command = StringTools.trim(command);
		var shellCommand = command;
		if(additionalArgs != null) {
			shellCommand += " " + additionalArgs.join(" ");
		}
		var task = new vscode_Task(definition,vscode_TaskScope.Workspace,name,"heaps");
		task.execution = new vscode_ShellExecution(shellCommand,{ cwd : Vscode.workspace.workspaceFolders[0].uri.fsPath, env : this.haxeEnvironment});
		if(group != null) {
			task.group = group;
		}
		task.problemMatchers = problemMatchers;
		task.presentationOptions = { reveal : presentation.reveal, echo : presentation.echo, focus : presentation.focus, panel : presentation.panel, showReuseMessage : presentation.showReuseMessage, clear : presentation.clear};
		return task;
	}
};
var Reflect = function() { };
Reflect.fields = function(o) {
	var a = [];
	if(o != null) {
		var hasOwnProperty = Object.prototype.hasOwnProperty;
		for( var f in o ) {
		if(f != "__id__" && f != "hx__closures__" && hasOwnProperty.call(o,f)) {
			a.push(f);
		}
		}
	}
	return a;
};
var StringTools = function() { };
StringTools.isSpace = function(s,pos) {
	var c = HxOverrides.cca(s,pos);
	if(!(c > 8 && c < 14)) {
		return c == 32;
	} else {
		return true;
	}
};
StringTools.ltrim = function(s) {
	var l = s.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s,r)) ++r;
	if(r > 0) {
		return HxOverrides.substr(s,r,l - r);
	} else {
		return s;
	}
};
StringTools.rtrim = function(s) {
	var l = s.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s,l - r - 1)) ++r;
	if(r > 0) {
		return HxOverrides.substr(s,0,l - r);
	} else {
		return s;
	}
};
StringTools.trim = function(s) {
	return StringTools.ltrim(StringTools.rtrim(s));
};
var SupportPlatform = function() { };
var Sys = function() { };
Sys.systemName = function() {
	var _g = process.platform;
	switch(_g) {
	case "darwin":
		return "Mac";
	case "freebsd":
		return "BSD";
	case "linux":
		return "Linux";
	case "win32":
		return "Windows";
	default:
		return _g;
	}
};
var Vscode = require("vscode");
var haxe_io_Path = function(path) {
	switch(path) {
	case ".":case "..":
		this.dir = path;
		this.file = "";
		return;
	}
	var c1 = path.lastIndexOf("/");
	var c2 = path.lastIndexOf("\\");
	if(c1 < c2) {
		this.dir = HxOverrides.substr(path,0,c2);
		path = HxOverrides.substr(path,c2 + 1,null);
		this.backslash = true;
	} else if(c2 < c1) {
		this.dir = HxOverrides.substr(path,0,c1);
		path = HxOverrides.substr(path,c1 + 1,null);
	} else {
		this.dir = null;
	}
	var cp = path.lastIndexOf(".");
	if(cp != -1) {
		this.ext = HxOverrides.substr(path,cp + 1,null);
		this.file = HxOverrides.substr(path,0,cp);
	} else {
		this.ext = null;
		this.file = path;
	}
};
haxe_io_Path.directory = function(path) {
	var s = new haxe_io_Path(path);
	if(s.dir == null) {
		return "";
	}
	return s.dir;
};
var haxe_iterators_ArrayIterator = function(array) {
	this.current = 0;
	this.array = array;
};
haxe_iterators_ArrayIterator.prototype = {
	hasNext: function() {
		return this.current < this.array.length;
	}
	,next: function() {
		return this.array[this.current++];
	}
};
var js_node_ChildProcess = require("child_process");
var vscode_ShellExecution = require("vscode").ShellExecution;
var vscode_StatusBarAlignment = require("vscode").StatusBarAlignment;
var vscode_Task = require("vscode").Task;
var vscode_TaskGroup = require("vscode").TaskGroup;
var vscode_TaskScope = require("vscode").TaskScope;
function $getIterator(o) { if( o instanceof Array ) return new haxe_iterators_ArrayIterator(o); else return o.iterator(); }
var $_;
function $bind(o,m) { if( m == null ) return null; if( m.__id__ == null ) m.__id__ = $global.$haxeUID++; var f; if( o.hx__closures__ == null ) o.hx__closures__ = {}; else f = o.hx__closures__[m.__id__]; if( f == null ) { f = m.bind(o); o.hx__closures__[m.__id__] = f; } return f; }
$global.$haxeUID |= 0;
if(typeof(performance) != "undefined" ? typeof(performance.now) == "function" : false) {
	HxOverrides.now = performance.now.bind(performance);
}
SupportPlatform.list = [{ name : "html5"},{ name : "android"},{ name : "ios"},{ name : "wechat", desc : "微信小游戏"}];
Main.main();
})(typeof exports != "undefined" ? exports : typeof window != "undefined" ? window : typeof self != "undefined" ? self : this, typeof window != "undefined" ? window : typeof global != "undefined" ? global : typeof self != "undefined" ? self : this);
