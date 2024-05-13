import sys.FileSystem;
import sys.io.File;
import js.node.Buffer;
import js.node.ChildProcess;
import SupportPlatform.Platfrom;
import haxe.DynamicAccess;
import vshaxe.TaskPresentationOptions;
import vscode.ExtensionContext;
import vscode.*;
import Vscode.*;
import haxe.io.Path;

using ArrayHelper;

@:keep
class Main {
	static function main() {}

	private var isProjectFileDirty:Bool = false;

	private var initialized:Bool;

	public var context:ExtensionContext;

	private var selectTargetItem:StatusBarItem;

	private var editTargetFlagsItem:StatusBarItem;

	private var haxeEnvironment:DynamicAccess<String>;

	private var disposables:Array<{function dispose():Void;}> = [];

	private var isProviderActive:Bool;
	private var displayArgumentsProvider:DisplayArgsProvider;
	private var displayArgumentsProviderDisposable:Disposable;

	public function new(context:ExtensionContext) {
		this.context = context;
		registerDebugConfigurationProviders();
		context.subscriptions.push(workspace.onDidChangeConfiguration(workspace_onDidChangeConfiguration));
		refresh();
	}

	private function workspace_onDidChangeConfiguration(_):Void {
		refresh();
	}

	public function refresh():Void {
		if (!initialized) {
			initialize();
			construct();
		}
		this.updateHaxeEnvironment();
		if (displayArgumentsProvider == null)
			constructDisplayArgumentsProvider();
	}

	private function deconstruct():Void {
		for (disposable in disposables) {
			disposable.dispose();
		}

		selectTargetItem = null;
		editTargetFlagsItem = null;
		isProjectFileDirty = false;

		disposables = [];
		initialized = false;
	}

	private function initialize():Void {
		this.initialized = true;

		targetItems = [];
		for (item in SupportPlatform.list) {
			targetItems.push({
				label: item.desc != null ? item.desc : item.name.toUpperCase(),
				target: item.name.toUpperCase(),
				args: []
			});
		}
	}

	private function construct():Void {
		selectTargetItem = window.createStatusBarItem(Left, 9);
		selectTargetItem.tooltip = "Select Heaps Target Configuration";
		selectTargetItem.command = "heaps.selectTarget";
		disposables.push(selectTargetItem);
		setTargetConfiguration(targetItems[0]);
		// editTargetFlagsItem = window.createStatusBarItem(Left, 7);
		// editTargetFlagsItem.command = "heaps.editTargetFlags";
		// disposables.push(editTargetFlagsItem);

		disposables.push(commands.registerCommand("heaps.selectTarget", selectTargetItem_onCommand));
		// // disposables.push(commands.registerCommand("lime.editTargetFlags", editTargetFlagsItem_onCommand));
		// // disposables.push(commands.registerCommand("lime.refreshCodeCompletion", refreshCodeCompletion));
		disposables.push(tasks.registerTaskProvider("heaps", this));
	}

	private inline function getVshaxe():Vshaxe {
		return extensions.getExtension("nadako.vshaxe").exports;
	}

	private function constructDisplayArgumentsProvider() {
		var api:Vshaxe = getVshaxe();

		displayArgumentsProvider = new DisplayArgsProvider(api, function(isProviderActive) {
			this.isProviderActive = isProviderActive;
			refresh();
		});

		if (untyped !api) {
			trace("Warning: Haxe language server not available (using an incompatible vshaxe version)");
		} else if (FileSystem.exists(getProjectDirectory() + "/zyheaps.xml")) {
			displayArgumentsProviderDisposable = api.registerDisplayArgumentsProvider("Heaps", displayArgumentsProvider);
			// } else {
			// window.showErrorMessage(getProjectDirectory() + "/zyheaps.xml not found");
		}
	}

	private var targetItems:Array<TargetItem>;

	private var currentTargetItem:TargetItem;

	private function selectTargetItem_onCommand():Void {
		var items = targetItems.copy();
		var targetItem = currentTargetItem;
		items.moveToStart(function(item) return item == targetItem);
		window.showQuickPick(items, {matchOnDetail: true, placeHolder: "Select Heaps Target Configuration"}).then(function(choice:TargetItem) {
			if (choice == null)
				return;
			setTargetConfiguration(choice);
		});
	}

	public function setTargetConfiguration(targetConfig:TargetItem):Void {
		if (this.currentTargetItem != null && this.currentTargetItem.label == targetConfig.label)
			return;
		if (!FileSystem.exists(getProjectDirectory() + "/zyheaps.xml")) {
			selectTargetItem.hide();
			return;
		}
		this.currentTargetItem = targetConfig;
		selectTargetItem.text = currentTargetItem.label;
		selectTargetItem.show();
		// displayArgumentsProvider.update();
		var commandLine = "haxelib run zyheaps hxml " + currentTargetItem.target.toLowerCase();
		ChildProcess.exec(commandLine, {cwd: workspace.workspaceFolders[0].uri.fsPath}, function(err, stdout:Buffer, stderror) {
			if (err != null && err.code != 0) {
				var message = 'Heaps completion setup failed, Align.';
				var showFullErrorLabel = "Show Full Error";
				window.showErrorMessage(message, showFullErrorLabel).then(function(selection) {
					if (selection == showFullErrorLabel) {
						commands.executeCommand("workbench.action.toggleDevTools");
					}
				});
			} else {
				var hxml = stdout.toString();
				var projectDirectory = getProjectDirectory();
				if (projectDirectory != "") {
					hxml += "\n--cwd \"" + projectDirectory + "\"";
				}
				displayArgumentsProvider.update(hxml);
			}
		});
	}

	private function getProjectDirectory():String {
		return workspace.workspaceFolders[0].uri.fsPath;
	}

	private function editTargetFlagsItem_onCommand():Void {}

	private function refreshCodeCompletion():Void {}

	private static var instance:Main;

	@:keep @:expose("activate") public static function activate(context:ExtensionContext) {
		instance = new Main(context);
	}

	@:keep @:expose("deactivate") public static function deactivate() {
		instance.deconstruct();
	}

	private function registerDebugConfigurationProviders():Void {
		debug.registerDebugConfigurationProvider("lime", cast this);
	}

	private function getTaskName(item:Platfrom):String {
		return "Heaps build platform " + (item.desc != null ? item.desc + "[" + item.name + "]" : item.name.toUpperCase());
	}

	public function provideTasks(?token:CancellationToken):ProviderResult<Array<Task>> {
		var vshaxe = getVshaxe();
		var tasks = [];
		if (FileSystem.exists(getProjectDirectory() + "/zyheaps.xml")) {
			for (item in SupportPlatform.list) {
				var definition:HeapsTaskDefinition = {
					"type": "heaps",
					"command": "haxelib run zyheaps build " + item.name,
					"targetConfiguration": item.name
				};
				var presentation = vshaxe.taskPresentation;
				var task = createTask(definition, getTaskName(item), definition.command, [], presentation, []);
				task.group = TaskGroup.Build;
				tasks.push(task);
				var definition:HeapsTaskDefinition = {
					"type": "heaps",
					"command": "haxelib run zyheaps build " + item.name + " -final",
					"targetConfiguration": item.name
				};
				var presentation = vshaxe.taskPresentation;
				var task = createTask(definition, getTaskName(item) + " (RELEASE)", definition.command, [], presentation, []);
				task.group = TaskGroup.Build;
				tasks.push(task);
			}
		}
		return tasks;
	}

	public function resolveTask(task:Task, ?token:CancellationToken):ProviderResult<Task> {
		return task;
	}

	private function updateHaxeEnvironment() {
		var haxeConfiguration = getVshaxe().haxeExecutable.configuration;
		var env = new DynamicAccess();

		for (field in Reflect.fields(haxeConfiguration.env)) {
			env[field] = haxeConfiguration.env[field];
		}

		if (!haxeConfiguration.isCommand) {
			var separator = Sys.systemName() == "Windows" ? ";" : ":";
			env["PATH"] = Path.directory(haxeConfiguration.executable) + separator + Sys.getEnv("PATH");
		}

		haxeEnvironment = env;
	}

	private function createTask(definition:HeapsTaskDefinition, name:String, command:String, additionalArgs:Array<String>,
			presentation:vshaxe.TaskPresentationOptions, problemMatchers:Array<String>, group:TaskGroup = null) {
		command = StringTools.trim(command);

		var shellCommand = command;
		if (additionalArgs != null)
			shellCommand += " " + additionalArgs.join(" ");

		var task = new Task(definition, TaskScope.Workspace, name, "heaps");
		task.execution = new ShellExecution(shellCommand, {
			cwd: workspace.workspaceFolders[0].uri.fsPath,
			env: haxeEnvironment
		});

		if (group != null) {
			task.group = group;
		}

		task.problemMatchers = problemMatchers;
		task.presentationOptions = {
			reveal: presentation.reveal,
			echo: presentation.echo,
			focus: presentation.focus,
			panel: presentation.panel,
			showReuseMessage: presentation.showReuseMessage,
			clear: presentation.clear
		};

		return task;
	}
}

private typedef HeapsTaskDefinition = {
	> TaskDefinition,
	var command:String;
	@:optional var targetConfiguration:String;
	@:optional var args:Array<String>;
}

private typedef TargetItem = {
	> QuickPickItem,
	var target:String;
	var args:Array<String>;
}
