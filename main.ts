import { appendFile, writeFile } from 'fs';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
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
			id: 'rename-res',
			name: '修改资源名称',
			callback: () => {
				new AddItemModal(this.app, this, "修改资源名称").open()
			}
		}); 

		// 创建一个新的命令
		this.addCommand({
			id: 'delete-res',
			name: '删除资源',
			callback: () => {
				new AddItemModal(this.app, this, "删除资源").open()
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
			id: 'rename-prj',
			name: '修改项目名称',
			callback: () => {
				new AddItemModal(this.app, this, "修改项目名称").open()
			}
		});

		// 创建一个新的命令
		this.addCommand({
			id: 'delete-prj',
			name: '删除项目',
			callback: () => {
				new AddItemModal(this.app, this, "删除项目").open()
			}
		});
		
		// 创建一个新的命令
		this.addCommand({
			id: 'update-MOC',
			name: '更新索引',
			callback: () => {
				this.updateMOC();
			}
		});

	}

	// 卸载插件
	onunload() {

	}

	// 异步：加载设置
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	// 异步：保存设置
	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateMOC() {
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

			// 处理资源MOC
			this.app.vault.read(resMOC).then(data => {
				// 处理获得未被引用的文件，并处理成特定的符合看板的字符串形式
				var NotIndexedFiles = '';
				for (var name of shouldbeIndexedFiles["资源"]) {
					if (IndexedFiles.indexOf(name) == -1) [
						NotIndexedFiles = `${NotIndexedFiles}- [ ] [[${name}]]\n`
					]
				}
				console.log(NotIndexedFiles)
				if (data.indexOf("## ") != -1) {
					var result = data.replace(/## .*?\n/, "$&" + NotIndexedFiles)
					
					writeFile(`${this.app.vault.adapter.basePath}\\${this.settings.resMOCfileName}.md`, result, () => {
						new Notice("资源索引更新完成")
					})
				}
				else {
					new Notice("请确保资源MOC文档为看板模式，且已设置一个列")
				}

			});
			
			// 处理项目MOC
			this.app.vault.read(prjMOC).then(data => {
				// 处理获得未被引用的文件，并处理成特定的符合看板的字符串形式
				var NotIndexedFiles = '';
				for (var name of shouldbeIndexedFiles["项目"]) {
					if (IndexedFiles.indexOf(name) == -1) [
						NotIndexedFiles = `${NotIndexedFiles}- [ ] [[${name}]]\n`
					]
				}
				console.log(NotIndexedFiles)
				if (data.indexOf("## ") != -1) {
					var result = data.replace(/## .*?\n/, "$&" + NotIndexedFiles)
					
					writeFile(`${this.app.vault.adapter.basePath}\\${this.settings.prjMOCfileName}.md`, result, () => {
						new Notice("项目索引更新完成")
					})
				}
				else {
					new Notice("请确保项目MOC文档为看板模式，且已设置一个列")
				}
			});
		}
	}

	// 查找所有应该被索引的文件夹，并且会检查topfolder下的文件结构是否符合规定。返回不带后缀.md的名称列表
	getShouldBeIndexedFilesList() {
		var attachmentFolder = this.app.vault.config.attachmentFolderPath.replace("./", "");

		const topFolder = this.settings.topFolder

		var root = this.app.vault.getAbstractFileByPath(topFolder);

		var shouldBeIndexedFilesList = new Array();
		shouldBeIndexedFilesList["资源"] = []
		shouldBeIndexedFilesList["项目"] = []

		// ==========================================================================
		// - /topFolder 的子文件 检查 1 级文件，应该只存在文件夹
		for (var FirstLevelChild of root.children){
			if (FirstLevelChild.path.endsWith(".md")){
				console.log(`${topFolder} 文件夹下不应出现md文档:\n${FirstLevelChild.name}`);
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
						console.log(`${FirstLevelChild.path} 文件夹下不应出现md文档:\n${SecondLevelChild.name}`);
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
						console.log(`${SecondLevelChild.path} 文件夹下缺少\n名为：${SecondLevelChild.name}.md 的入口文档`);
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
		this.plugin.updateMOC();
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
		
		// 按下按键
		creatButton.onclick = function() {
			// 检查名称是否合规
			if (plugin.checkNameFormat(newItemName.value)) {
				// 检查是否存在重名文件
				var indexedFiles = plugin.getShouldBeIndexedFilesList()
				var okToGoOn = true
				for (var key in indexedFiles){
					if (indexedFiles[key].indexOf(newItemName.value) != -1) {
						new Notice("已存在重名文件，请重新输入新名称");
						okToGoOn = false
						break
					}
				}
				// 若都无问题，则可以进行操作
				if (okToGoOn) {
					plugin.app.vault.createFolder(`${plugin.settings.topFolder}/${folderName}/${newItemName.value}`)
					for (var file of plugin.app.vault.getMarkdownFiles()) {
						if (file.path == `${plugin.settings.templatesFolder}/${folderName}-模板.md`){
							plugin.app.vault.create(
								`${plugin.settings.topFolder}/${folderName}/${newItemName.value}/${newItemName.value}.md`,
								file.unsafeCachedData,
							)
							new Notice(`已成功${opType}：${newItemName.value}`)
						}
					}
				}
			}
		} 
	}
	
	renameItem(folderName: string){

		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`${this.opType}`);

		// 2、输入框＋候选框
		var newItemName = contentEl.createEl("input")
		newItemName.placeholder = "原文件旧名称";
		newItemName.setAttrs({
			"class": "kanbanMOC",
			"list": "fileSearch"
		});
		var searchResult = contentEl.createEl("datalist")
		searchResult.setAttrs({
			"class": "kanbanMOC",
			"id": "fileSearch"
		});
		var modal = this
		var plugin = this.plugin
		newItemName.oninput = function(){
			searchToSelect(newItemName.value, modal.opType, plugin, searchResult)
		}

		contentEl.createEl("br")

		// 3、输入框
		var newItemName2 = contentEl.createEl("input")
		newItemName2.placeholder = "原文件新名称";
		newItemName2.setAttrs({
			"class": "kanbanMOC",
		});

		contentEl.createEl("br")

		// 4、按钮
		var creatButton = contentEl.createEl("button");
		creatButton.setText("   确定   ");
		creatButton.setAttrs({
			"class": "kanbanMOC",
		});
		
		// ============ 操作 ============
		var opType = this.opType

		// 按下按键
		creatButton.onclick = function() {
			// 检查名称是否合规
			if (plugin.checkNameFormat(newItemName.value) && plugin.checkNameFormat(newItemName2.value)) {
				// 检查旧名称是否存在、新名称是否重复
				var indexedFiles = plugin.getShouldBeIndexedFilesList()
				var oldNameExists = false
				var newNameRepeat = false
				for (var key in indexedFiles){
					if (indexedFiles[key].indexOf(newItemName.value) != -1) {
						oldNameExists = true
					}
					if (indexedFiles[key].indexOf(newItemName2.value) != -1) {
						newNameRepeat = true
					}
				}
				if (newNameRepeat || !oldNameExists) {
					if(!oldNameExists){
						new Notice("原文件不存在，请重新输入原文件旧名称：");
					}
					if (newNameRepeat){
						new Notice("新文件名重复，请重新输入原文件新名称：");
					}
				}
				// 若都无问题，则可以进行操作
				else{
					var opFile = plugin.app.vault.getAbstractFileByPath(`${plugin.settings.topFolder}/${folderName}/${newItemName.value}/${newItemName.value}.md`)
					plugin.app.fileManager.renameFile(opFile, `${plugin.settings.topFolder}/${folderName}/${newItemName.value}/${newItemName2.value}.md`)
					
					var oldFolder = plugin.app.vault.getAbstractFileByPath(`${plugin.settings.topFolder}/${folderName}/${newItemName.value}`)
					plugin.app.fileManager.renameFile(oldFolder,`${plugin.settings.topFolder}/${folderName}/${newItemName2.value}`)
					new Notice(`已成功${opType}：${newItemName.value} => ${newItemName2.value}`)
				}
			}
		}
	}

	deleteItem(folderName: string){

		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`${this.opType}`);

		// 2、输入框+候选框
		var newItemName = contentEl.createEl("input")
		newItemName.placeholder = "删除的文件名称";
		newItemName.setAttrs({
			"class": "kanbanMOC",
			"list": "fileSearch"
		});
		var searchResult = contentEl.createEl("datalist")
		searchResult.setAttrs({
			"class": "kanbanMOC",
			"id": "fileSearch"
		});
		var modal = this
		var plugin = this.plugin
		newItemName.oninput = function(){
			searchToSelect(newItemName.value, modal.opType, plugin, searchResult)
		}

		contentEl.createEl("br")

		// 3、输入框
		var newItemName2 = contentEl.createEl("input")
		newItemName2.placeholder = "请手动输入：确认删除";
		newItemName2.setAttrs({
			"class": "kanbanMOC",
			"onpaste": "return false",
			"oncut": "return false"
		});

		contentEl.createEl("br")

		// 4、按钮
		var creatButton = contentEl.createEl("button");
		creatButton.setText("   确定   ");
		creatButton.setAttrs({
			"class": "kanbanMOC",
		});
		
		// ============ 操作 ============
		var plugin = this.plugin
		var opType = this.opType

		// 按下按键
		creatButton.onclick = function() {
			// 检查名称是否合规
			if (plugin.checkNameFormat(newItemName.value)) {
				if (newItemName2.value == "确认删除"){
					// 检查名称是否存在
					var indexedFiles = plugin.getShouldBeIndexedFilesList()
					var oldNameExists = false
					for (var key in indexedFiles){
						if (indexedFiles[key].indexOf(newItemName.value) != -1) {
							oldNameExists = true
						}
					}
					if (!oldNameExists) {
						new Notice("原文件不存在，请重新输入原文件旧名称：");
					}
					// 若都无问题，则可以进行操作
					else{
						var oldFolder = plugin.app.vault.getAbstractFileByPath(`${plugin.settings.topFolder}/${folderName}/${newItemName.value}`);
						plugin.app.vault.trash(oldFolder, true)
						new Notice(`已成功${opType}：${newItemName.value}\n文件已移入系统回收站`)
					}

				}else{
					new Notice("请手动输入：确认删除")
				}
			}
		}
	}
}


//模糊查询1:利用字符串的indexOf方法
function searchToSelect(keyWord: string, resOrPrj: string, plugin: MyPlugin, searchResult: HTMLDataListElement){
	if (keyWord){
		var sList = new Array()
		if (resOrPrj.indexOf("资源") != -1) {
			sList = plugin.getShouldBeIndexedFilesList()["资源"]
		}
		else if (resOrPrj.indexOf("项目") != -1) {
			sList = plugin.getShouldBeIndexedFilesList()["项目"]
		}
		var len = sList.length;
		var arr = [];
		for(var i=0;i<len;i++){
			//如果字符串中不包含目标字符会返回-1
			if(sList[i].toLowerCase().indexOf(keyWord.toLowerCase())>=0){
				arr.push(sList[i]);
				// 只显示 5 个候选结果
				if (arr.length >= 5){
					break
				}
			}
		}
		searchResult.innerHTML = '';
		var item = null;
		for(var i=0; i<arr.length ;i++){
			item = document.createElement('option');
			item.innerHTML = arr[i];
			searchResult.appendChild(item);
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
