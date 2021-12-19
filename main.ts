import { appendFile, fstat, readFile, writeFile } from 'fs';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceItem, Menu, TFile, MenuItem } from 'obsidian';
import { isAbsolute } from 'path';
import * as path from 'path/posix';

// Remember to rename these classes and interfaces!

// 定义插件里需要保存、用到的变量
interface MyPluginSettings {
	topFolder: string;
	resMOCfileName: string;
	prjMOCfileName: string;
	templatesFolder: string;
}

// 定义 DEFAULT_SETTINGS 并使用接口设置（DEFAULT_SETTINGS会在后边的插件主功能中的“loadSettings”（加载设置）中用到）
const DEFAULT_SETTINGS: MyPluginSettings = {
	topFolder: 'AllFiles',
	resMOCfileName: '',
	prjMOCfileName: '',
	templatesFolder: 'AllFiles/templates',
}

// 插件主功能设置！！
export default class MyPlugin extends Plugin { 
	settings: MyPluginSettings;
	clickFile: TFile;

	// 异步：加载插件
	async onload() {
		await this.loadSettings();
		
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// 创建一个新的命令
		this.addCommand({
			id: 'create-res',
			name: '创建新资源',
			callback: () => {
				new AddItemModal(this.app, this, "创建新资源").open()
			}
		});

		// 创建一个新的命令
		this.addCommand({
			id: 'create-prj',
			name: '创建新项目',
			callback: () => {
				new AddItemModal(this.app, this, "创建新项目").open()
			}
		}); 
		
		// 创建一个新的命令
		this.addCommand({
			id: 'update-MOC',
			name: '更新索引',
			callback: () => {
				this.updateMOC("资源");
				this.updateMOC("项目");
			}
		});

		// 修改资源或项目名称
		const fileMenuHandlerRenameFile = (menu: Menu, file: TFile) => {
			menu.addItem((item: MenuItem) => {
				item
				.setTitle("看板MOC：修改文件名称")
				// .setIcon("folder")
				.onClick(() => {
					if (this.checkSettings()) {
						this.clickFile = file
						if (this.checkResOrPrj(file.basename) == "资源") {
							new AddItemModal(this.app, this, "修改资源名称").open()
						}
						else if (this.checkResOrPrj(file.basename) == "项目") {
							new AddItemModal(this.app, this, "修改项目名称").open()
						}
						else {
							new Notice("该文件不是资源或项目的入口文档")
						}
					}
				});
			});
		};

		
		this.registerEvent(
			this.app.workspace.on("file-menu", fileMenuHandlerRenameFile),
		);

		// 删除资源或项目
		const fileMenuHandlerDeleteFile = (menu: Menu, file: TFile) => {
			menu.addItem((item: MenuItem) => {
				item
				.setTitle("看板MOC：删除文件")
				// .setIcon("folder")
				.onClick(() => {
					if (this.checkSettings()) {
						this.clickFile = file
						if (this.checkResOrPrj(file.basename) == "资源") {
							new AddItemModal(this.app, this, "删除资源").open()
						}
						else if (this.checkResOrPrj(file.basename) == "项目") {
							new AddItemModal(this.app, this, "删除项目").open()
						}
						else {
							new Notice("该文件不是资源或项目的入口文档")
						}
					}
				});
			});
		};
		
		this.registerEvent(
			this.app.workspace.on("file-menu", fileMenuHandlerDeleteFile),
		);

	}

	// 卸载插件
	onunload() {

	}

	// 异步：加载设置
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// ======================= 自定义函数 =======================

	// 异步：保存设置
	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 更新索引
	updateMOC(opType: string) {
		if (this.checkSettings()) {
			for (var file of this.app.vault.root.children) {
				if (file.name == `${this.settings.resMOCfileName}.md`) {
					var resMOC = file
				}
				else if (file.name == `${this.settings.prjMOCfileName}.md`) {
					var prjMOC = file
				}
			}
			// 处理获得已经被引用的文件名称列表
			var shouldbeIndexedFiles = this.getShouldBeIndexedFilesList();
			var IndexedFiles = new Array();
			if (opType == "资源") {
				if (this.app.metadataCache.getFileCache(resMOC).links) {
					for (var link of this.app.metadataCache.getFileCache(resMOC).links) {
						for (var name of shouldbeIndexedFiles["资源"]) {
							if (link.link == name) {
								IndexedFiles.push(name)
								break
							}
						}
					}
				}
				// 处理资源MOC
				this.app.vault.read(resMOC).then(data => {
					// 处理获得未被引用的文件，并处理成特定的符合看板的字符串形式
					var NotIndexedFiles = '';
					for (var name of shouldbeIndexedFiles["资源"]) {
						if (IndexedFiles.indexOf(name) == -1) [
							NotIndexedFiles = `${NotIndexedFiles}- [ ] [[${name}]]\n`
						]
					}
					if (data.indexOf("## ") != -1) {
						var result = data.replace(/## .*?\n/, "$&" + NotIndexedFiles)

						this.app.vault.adapter.write(`${this.settings.resMOCfileName}.md`, result).then(data => {
							new Notice("资源索引更新完成")

						})
					}
					else {
						new Notice("请确保资源MOC文档为看板模式，且已设置至少一个列")
					}
	
				});
			}
			else if (opType == "项目") {
				if (this.app.metadataCache.getFileCache(prjMOC).links) {
					for (var link of this.app.metadataCache.getFileCache(prjMOC).links) {
						for (var name of shouldbeIndexedFiles["项目"]) {
							if (link.link == name) {
								IndexedFiles.push(name)
								break
							}
						}
					}
				}
				// 处理项目MOC
				this.app.vault.read(prjMOC).then(data => {
					// 处理获得未被引用的文件，并处理成特定的符合看板的字符串形式
					var NotIndexedFiles = '';
					for (var name of shouldbeIndexedFiles["项目"]) {
						if (IndexedFiles.indexOf(name) == -1) [
							NotIndexedFiles = `${NotIndexedFiles}- [ ] [[${name}]]\n`
						]
					}
					// console.log(NotIndexedFiles)
					if (data.indexOf("## ") != -1) {
						var result = data.replace(/## .*?\n/, "$&" + NotIndexedFiles)
						this.app.vault.adapter.write(`${this.settings.prjMOCfileName}.md`, result).then(data => {
							new Notice("项目索引更新完成")

						})
					}
					else {
						new Notice("请确保项目MOC文档为看板模式，且已设置一个列")
					}
				});
			}
		}
	}

	// 根据文件名称（不带后缀）检查是否为资源或项目的入口文件，是返回"资源"或"项目"，否则返回false
	checkResOrPrj(fileName: string) {
		if (this.getShouldBeIndexedFilesList()["资源"].indexOf(fileName) != -1) {
			return "资源"
		}
		else if (this.getShouldBeIndexedFilesList()["项目"].indexOf(fileName) != -1) {
			return "项目"
		}
		else return false
	}

	// 检查文件名称是否重复，若重复则返回 true，否则返回 false
	isMarkdownNameRepeated(filename: string) {
		for (var file of this.app.vault.getMarkdownFiles()){
			if (file.basename == filename) {
				return true
			}
		}
		return false
	}

	// 查找所有应该被索引的文件夹，并且会检查topfolder下的文件结构是否符合规定。返回不带后缀.md的名称列表
	getShouldBeIndexedFilesList() {

		const topFolder = this.settings.topFolder

		var root = this.app.vault.getAbstractFileByPath(topFolder);

		var shouldBeIndexedFilesList = new Array();
		shouldBeIndexedFilesList["资源"] = []
		shouldBeIndexedFilesList["项目"] = []

		// ==========================================================================
		// - /topFolder 的子文件 检查 1 级文件，应该只存在文件夹
		for (var FirstLevelChild of root.children){
			if (FirstLevelChild.path.endsWith(".md")){
				new Notice(`${topFolder} 文件夹下不应出现md文档:\n${FirstLevelChild.name}`);
			}
			// 不是文档就是文件夹（假设没有其它的东西）
			else if (FirstLevelChild.path == this.settings.templatesFolder){

			}
			else {
				// FirstLevelChild.name是资源或项目
				shouldBeIndexedFilesList[FirstLevelChild.name] = [];
				// ============================================================================
				// - /topFolder/项目 的子文件 检查 2 级文件，应该只存在文件夹
				for (var SecondLevelChild of FirstLevelChild.children){
					var RukouFile = false;
					if (SecondLevelChild.path.endsWith(".md")){
						new Notice(`${FirstLevelChild.path} 文件夹下不应出现md文档:\n${SecondLevelChild.name}`);
					}
					// 不是文档就是文件夹（假设没有其它的东西）
					else {
						// ============================================================================
						// - /topFolder/项目/水质检测 的子文件 检查 3 级文件，应包含入口文档，即和父文件夹同名
						for (var ThirdLevelChild of SecondLevelChild.children){
							if (ThirdLevelChild.path.endsWith(".md") && ThirdLevelChild.name.replace(".md", "") == SecondLevelChild.name){
								RukouFile = true;
								break
							}
						}
					}
					if (RukouFile){
						shouldBeIndexedFilesList[FirstLevelChild.name].push(SecondLevelChild.name);
					}
					else{
						new Notice(`${SecondLevelChild.path} 文件夹下缺少\n名为：${SecondLevelChild.name}.md 的入口文档`);
					}
				}
			}
		}
		return shouldBeIndexedFilesList
	}

	// 检查名称是否符合格式
	checkNameFormat(name: string) {
		if (name){
			for (var cha of name){
				if ('*"\\/<>:|?'.indexOf(cha) != -1){
					new Notice("命名不得出现以下字符：*\"\\/<>:|?")
					return false
				}
			}
			return true
		}
		else return false;
	}

	// 检查设置
	checkSettings() {

		// 判断topFolder、资源MOC、项目MOC文件是否在库的根目录
		var topFolderInRoot = false;
		var resMOCfileNameInRoot = false;
		var prjMOCfileNameInRoot = false;
		for (var file of this.app.vault.root.children){
			if (file.path == this.settings.topFolder) {
				topFolderInRoot = true
			}
			if (file.path == `${this.settings.resMOCfileName}.md`) {
				resMOCfileNameInRoot = true
			}
			if (file.path == `${this.settings.prjMOCfileName}.md`) {
				prjMOCfileNameInRoot = true
			}
		}

		// 判断模板文件夹是否存在，并判断模板文件是否存在
		var templatesFolderExist = false;
		var resTemplateExist = false;
		var prjTemplateExist = false;
		if (this.app.vault.getAbstractFileByPath(this.settings.templatesFolder)) {
			templatesFolderExist = true
			for (var file of this.app.vault.getAbstractFileByPath(this.settings.templatesFolder).children){
				if (file.name == "资源-模板.md") {
					resTemplateExist = true
				}
				if (file.name == "项目-模板.md") {
					prjTemplateExist = true
				}
			}
		}

		// 无问题则进行操作
		if (topFolderInRoot && resMOCfileNameInRoot && prjMOCfileNameInRoot && templatesFolderExist && resTemplateExist && prjTemplateExist) {
			return true
		}
		else {
			if (!topFolderInRoot) {
				new Notice("总文件夹路径必须是位于库的根目录下的文件夹")
			}
			if (!resMOCfileNameInRoot) {
				new Notice("资源MOC文档路径必须是位于库的根目录下")
			}
			if (!prjMOCfileNameInRoot) {
				new Notice("项目MOC文档路径必须是位于库的根目录下")
			}
			if (!templatesFolderExist) {
				new Notice(`模板文件夹 ${this.settings.templatesFolder} 不存在`)
			}
			else{
				if (!resTemplateExist) {
					new Notice(`未在 ${this.settings.templatesFolder} 中找到“资源-模板.md”文档`)
				}
				if (!prjTemplateExist) {
					new Notice(`未在 ${this.settings.templatesFolder} 中找到“项目-模板.md”文档`)
				}
			}
			return false
		}
	}
}


// 新建文件面板
class AddItemModal extends Modal {
	plugin: MyPlugin;
	folderName: string;
	opType: string;

	constructor(app: App, plugin: MyPlugin, opType: string) {
		/**path 为
		 */
		super(app);
		this.plugin = plugin;
		this.opType = opType;

	}

	onOpen(): void {

		if (this.plugin.checkSettings()) {
			switch(this.opType) {
				case "创建新资源": this.createItem("资源"); break;
				case "修改资源名称": this.renameItem("资源");break;
				case "删除资源": this.deleteItem("资源");break;
				case "创建新项目": this.createItem("项目"); break;
				case "修改项目名称": this.renameItem("项目");break;
				case "删除项目": this.deleteItem("项目");break;
				default:
		   }
		}
		else this.close(); 
	}

	onClose(): void {
		if (this.opType.indexOf("资源") != -1) {
			setTimeout(() => {
				this.plugin.updateMOC("资源");
			}, 500)
		}
		else if (this.opType.indexOf("项目") != -1) {
			setTimeout(() => {
				this.plugin.updateMOC("项目");
			}, 500)
		}
	}

	createItem(folderName: string){

		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`${this.opType}`);

		// 2、输入框
		var newItemName = contentEl.createEl("input")
		newItemName.placeholder = "新文件的名称";
		newItemName.setAttrs({
			"class": "kanbanMOC",
		});

		// 3、按钮
		var creatButton = contentEl.createEl("button");
		creatButton.setText("   确定   ");
		creatButton.setAttrs({
			"class": "kanbanMOC",
		});
		
		// ============ 操作 ============
		var plugin = this.plugin
		var opType = this.opType
		var modal = this
		
		// 按下按键
		creatButton.onclick = function() {
			// 检查名称是否合规
			if (plugin.checkNameFormat(newItemName.value)) {
				// 检查是否存在重名文件
				if (!plugin.isMarkdownNameRepeated(newItemName.value)) {
					// 若都无问题，则可以进行操作
					plugin.app.vault.createFolder(`${plugin.settings.topFolder}/${folderName}/${newItemName.value}`)
					for (var file of plugin.app.vault.getMarkdownFiles()) {
						if (file.path == `${plugin.settings.templatesFolder}/${folderName}-模板.md`){
							plugin.app.vault.create(
								`${plugin.settings.topFolder}/${folderName}/${newItemName.value}/${newItemName.value}.md`,
								file.unsafeCachedData,
							)
							new Notice(`已成功${opType}：${newItemName.value}`)
							modal.close()
						}
					}
				}
				else {
					new Notice("新名称和其它文档重名，请重新输入。\n⚠️入口文档最好不要同任何文档重名！！！");
				}
			}
		}
	}
	
	renameItem(folderName: string){

		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`${this.opType}: ${this.plugin.clickFile.basename}`);

		contentEl.createEl("br")

		// 2、输入框
		var newItemName2 = contentEl.createEl("input")
		newItemName2.placeholder = "请输入新名称";
		newItemName2.setAttrs({
			"class": "kanbanMOC",
		});

		contentEl.createEl("br")

		// 3、按钮
		var creatButton = contentEl.createEl("button");
		creatButton.setText("   确定   ");
		creatButton.setAttrs({
			"class": "kanbanMOC",
		});
		
		// ============ 操作 ============
		var modal = this
		var plugin = this.plugin
		var opType = this.opType

		// 按下按键
		creatButton.onclick = function() {
			// 检查新名称是否合规
			if (plugin.checkNameFormat(newItemName2.value)) {
				// 检查新名称是否重复（入口文档不能和任何文档重复）
				if (!plugin.isMarkdownNameRepeated(newItemName2.value)) {
					// 若都无问题，则可以进行操作
					var opFile = plugin.app.vault.getAbstractFileByPath(plugin.clickFile.path)
					plugin.app.fileManager.renameFile(opFile, plugin.clickFile.path.replace(plugin.clickFile.name, `${newItemName2.value}.md`))
					
					var oldFolder = plugin.app.vault.getAbstractFileByPath(plugin.clickFile.parent.path)
					plugin.app.fileManager.renameFile(oldFolder,plugin.clickFile.parent.path.replace(plugin.clickFile.parent.name, newItemName2.value))
					new Notice(`已成功${opType}：${plugin.clickFile.basename} => ${newItemName2.value}`)
					modal.close()
				}
				else {
					new Notice("新名称和其它文档重名，请重新输入。\n⚠️入口文档最好不要同任何文档重名！！！");
				}
			}
		}
	}

	deleteItem(folderName: string){

		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`⚠️${this.opType}: ${this.plugin.clickFile.basename}`);

		contentEl.createEl("br")

		// 2、输入框
		var newItemName = contentEl.createEl("input")
		newItemName.placeholder = "请手动输入：确认删除";
		newItemName.setAttrs({
			"class": "kanbanMOC",
			"onpaste": "return false",
			"oncut": "return false"
		});

		contentEl.createEl("br")

		// 3、按钮
		var creatButton = contentEl.createEl("button");
		creatButton.setText("   确定   ");
		creatButton.setAttrs({
			"class": "kanbanMOC",
		});
		
		// ============ 操作 ============
		var plugin = this.plugin
		var opType = this.opType
		var modal = this

		// 按下按键
		creatButton.onclick = function() {
			// 若都无问题，则可以进行操作
			if (newItemName.value == "确认删除"){

				// 移除文件夹（删除文件的位置应该是obsidian的删除文件位置）
				var oldFolder = plugin.app.vault.getAbstractFileByPath(plugin.clickFile.parent.path);
				plugin.app.vault.trash(oldFolder, true)		// Tries to move to system trash. If that isn't successful/allowed, use local trash
				new Notice(`已成功${opType}：${plugin.clickFile.basename}`)

				// 处理资源或项目MOC，删除替换删除的索引项
				for (var file of plugin.app.vault.root.children) {
					if (file.name == `${plugin.settings.resMOCfileName}.md` && opType.indexOf("资源") != -1) {
						var MOCfile = file
						break
					}
					else if (file.name == `${plugin.settings.prjMOCfileName}.md` && opType.indexOf("项目") != -1) {
						var MOCfile = file
						break
					}
				}
				
				plugin.app.vault.read(MOCfile).then(data => {
					// 处理MOC中删除的文件的链接
					var result = data.replace(`- [ ] [[${plugin.clickFile.basename}]]\n`, "").replace(`- [x] [[${plugin.clickFile.basename}]]\n`, "").replace(`[[${plugin.clickFile.basename}]]`, `${plugin.clickFile.basename}`)
					if (opType.indexOf("资源") != -1) {
						this.app.vault.adapter.write(`${this.settings.resMOCfileName}.md`, result).then(data => {
							new Notice("资源索引更新完成")
							modal.close()
						})
					}
					else if (opType.indexOf("项目") != -1) {
						this.app.vault.adapter.write(`${this.settings.prjMOCfileName}.md`, result).then(data => {
							new Notice("项目索引更新完成")
							modal.close()
						})
					}
	
				});

			}else{
				new Notice("请手动输入：确认删除")
			}
		}
	}
}


// 插件设置页面
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// 新建标题、介绍
		containerEl.createEl('h2', {text: '看板MOC设置面板.'});
		containerEl.createEl('a', {text: "github地址", 'href': "https://github.com/1657744680/obsidian-Kanban-MOC"})
		containerEl.createEl('br')
		containerEl.createEl('a', {text: "以下所有选项都必须进行设置！！"})

		// 新建一个设置选项
		new Setting(containerEl)
			.setName('总文件夹路径：')
			.setDesc('☣️注意：必须是位于库的根目录下的文件夹！！\n💡说明：将想要存放资源、项目文件夹的路径写在方框内:\n若写：AllFiles，则在新建资源、项目时\n将在 /Allfiles/资源/ 或 /Allfiles/项目/ 路径下创建新的文件')
			.addText(text => text
				.setPlaceholder('例如 AllFiles')
				.setValue(this.plugin.settings.topFolder)
				.onChange(async (value) => {
					this.plugin.settings.topFolder = value;
					await this.plugin.saveSettings();
				}));

		// 新建一个设置选项
		new Setting(containerEl)
			.setName('资源MOC文件选择：')
			.setDesc('☣️注意：必须是位于库的根目录下的文档！！\n除此之外MOC文档还需要设置成kanban并有至少一列\n💡说明：例如我想选择“资源MOC.md”作为我的资源MOC文档，那我就写“资源MOC”')
			.addText(text => text
				.setPlaceholder('例如 资源MOC')
				.setValue(this.plugin.settings.resMOCfileName)
				.onChange(async (value) => {
					this.plugin.settings.resMOCfileName = value;
					await this.plugin.saveSettings();
				}));
		

		// 新建一个设置选项
		new Setting(containerEl)
			.setName('项目MOC文件选择：')
			.setDesc('☣️注意：必须是位于库的根目录下的文档！！\n除此之外MOC文档还需要设置成kanban并有至少一列\n💡说明：例如我想选择“项目MOC.md”作为我的项目MOC文档，那我就写“项目MOC”')
			.addText(text => text
				.setPlaceholder('例如 项目MOC')
				.setValue(this.plugin.settings.prjMOCfileName)
				.onChange(async (value) => {
					this.plugin.settings.prjMOCfileName = value;
					await this.plugin.saveSettings();
				}));

		// 新建一个设置选项
		new Setting(containerEl)
			.setName('入口文档模板文件夹设置：')
			.setDesc('☣️注意：模板文件夹中必须包含“资源-模板.md”和“项目-模板.md”2个文档！！\n💡说明：例如我想为资源文件设置一个模板，则在模板文件夹下新建一个名为“资源-模板.md”的文档')
			.addText(text => text
				.setPlaceholder('例如 AllFiles/templates')
				.setValue(this.plugin.settings.templatesFolder)
				.onChange(async (value) => {
					this.plugin.settings.templatesFolder = value;
					await this.plugin.saveSettings();
				}));
	}
}
