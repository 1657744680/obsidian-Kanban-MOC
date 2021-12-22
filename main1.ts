import { appendFile, fstat, readFile, writeFile } from 'fs';
import { App, Editor, MarkdownView,SearchComponent, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceItem, Menu, TFile, MenuItem, TAbstractFile, LinkCache} from 'obsidian';
import { isAbsolute } from 'path';
import * as path from 'path/posix';





// 定义插件里需要保存、用到的变量
interface MyPluginSettings {
	topFolderPath: string;
	templatesFolderPath: string;
}

// 定义 DEFAULT_SETTINGS 并使用接口设置（DEFAULT_SETTINGS会在后边的插件主功能中的“loadSettings”（加载设置）中用到）
const DEFAULT_SETTINGS: MyPluginSettings = {
	topFolderPath: 'AllFiles',
	templatesFolderPath: '',
}

/**
 * 通知并打印消息
 * @param message 消息
 */
function noticeAndLog(message: string) {
	console.log(`MOC-plugin:\n${message}`)
	new Notice(message)
}

// 插件主功能设置！！
export default class MyPlugin extends Plugin { 
	settings: MyPluginSettings;
	clickFile: TFile;
	MOCTemplateStr: string;

	// 异步：加载插件
	async onload() {
		await this.loadSettings();
		
		this.addSettingTab(new SettingTab(this.app, this));
		
		/**命令：新建MOC文件
		 * 		触发方式：调出命令面板触发
		 * 		结果：新建空白文件到库的根目录，并将空白文件转为看板（内容：Kanban的模板内容 + 自定义的frontmatter：kanban-MOC: true）
		 */
		this.addCommand({
			id: 'create-MOC',
			name: '新建MOC文件',
			callback: () => {
				// 执行任何一条命令前都需要执行设置检查
				if (this.checkSettings()) {
					
					// new ItemModal(this, "新建MOC文件").open();
				}
			}
		});

		/**命令：设置当前文件为MOC
		 * 		触发方式：右键菜单（文档菜单）操作
		 * 		触发条件：空白文件
		 * 		结果：将空白文件转为看板（内容：Kanban的模板内容 + 自定义的frontmatter：kanban-MOC: true）
		 */
		this.registerEvent(
			this.app.workspace.on("file-menu", async (menu, file: TFile) => {
				// 检查插件设置
				this.checkSettings().then(async bool => {
					if (bool) {
						// 检查文件是否为空文件
						console.log(222)
						await this.app.vault.read(file).then(data => {
							console.log(data) 
							if (!data.replace("\n", "").replace(" ", "")) {
								// 为空文件则添加命令：设置当前文件为MOC
								menu.addItem((item: MenuItem) => {
									item
									.setTitle("看板MOC: 设置当前文件为MOC")
									// .setIcon("folder")
									.onClick(() => {
										this.clickFile = file
										this.app.vault.adapter.write(this.clickFile.path, this.MOCTemplateStr)
									});
								});
							}
						})
					}
				})
			}),
		);


		/**监听 rename 事件
		 * 		监听所有的MOC文档：若改名则重命名其对应的位于topFolderPath下的文件夹
		 * 		监听所有的MOC文件夹：若改名则重命名其对应的MOC文档
		 *		监听所有的项目文件夹：若改名则重命名其对应的入口文档，并更新索引
		 *		监听所有的项目入口文档：若改名则重命名其对应的项目文件夹，并更新索引
		 */
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {

				// 判断是否为文档改名
				if (oldPath.endsWith(".md")) {
					// 判断是否为MOC文档改名
					for (var MOC of this.getAllMOCFiles()) {
						if (MOC.tFile.path == file.path) {
							var oldName = oldPath.split("/").pop()
							this.app.vault.rename(this.app.vault.getAbstractFileByPath(`${this.settings.topFolderPath}/${oldName}`), `${this.settings.topFolderPath}/${file.name.replace(".md", "")}`)
						}
					}
					// 判断是否为项目入口文档改名
					// for (var )
				}
			})
		)
		

		
		/**命令：从该MOC新建项目
		 * 		触发方式：右键菜单（文档菜单）操作
		 * 		触发条件：MOC文件
		 * 		结果：新建项目到 /topFolderPath/MOC文件名/
		 */

		
		
		// 创建一个新的命令
		this.addCommand({
			id: 'update-MOC',
			name: '更新索引',
			callback: () => {
				
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

	// ======================= 自定义函数 =======================

	// 异步：保存设置
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 获取所有MOC文件（通过 metadataCache）
	 * @returns 
	 */
	getAllMOCFiles(): Array<MOCPage> {
		var AllMOCPages = new Array()
		for (var file of this.app.vault.getMarkdownFiles()) {
			var cahe = this.app.metadataCache.getCache(file.path)
			if (cahe.hasOwnProperty("frontmatter")) {
				if (cahe.frontmatter.hasOwnProperty("MOC")) {
					if (cahe.frontmatter["MOC"] == true) {
						AllMOCPages.push(new MOCPage(this, file))  
					}
				}
			}
		}
		return AllMOCPages
	}

	createNewMOC(MOCName: string) {
		if (this.checkNameFormat(MOCName)) {
			// 创建新的MOC文档
			// awiat this.app.vault.create(`${MOCName}.md`, data => {

			// })
			// 创建新的MOC文件夹
		}
	}


	// 检查名称是否符合格式
	checkNameFormat(name: string) {
		if (name){
			for (var cha of name){
				if ('*"\\/<>:|?'.indexOf(cha) != -1){
					noticeAndLog("命名不得出现以下字符: *\"\\/<>:|?")
					return false
				}
			}
			return true
		}
		else return false;
	}

	// 检查设置
	async checkSettings() {
		



		console.log(this.app.vault.getAbstractFileByPath("")) 
		// 1 topFolderPath
		// 🔴1.1 设置：检测是否有值：不存在则尝试创建提示无法继续
		if (!this.settings.topFolderPath) {
			this.settings.topFolderPath = DEFAULT_SETTINGS.topFolderPath
			noticeAndLog(`topFolderPath 已设置为默认值: ${DEFAULT_SETTINGS.topFolderPath}`)
		}
		// 🟡1.1 检测 topFolderPath 路径对应文件夹：不存在则尝试创建
		if (!this.app.vault.getAbstractFileByPath(this.settings.topFolderPath)) {
			await this.app.vault.createFolder(this.settings.topFolderPath).catch(reason => {
				// 🔴按照 topFolderPath 创建 topFolder 文件夹失败
				noticeAndLog(`尝试创建: "${this.settings.topFolderPath}" 对应的文件夹失败，请检查 topFolderPath 设置`)
				console.log(reason)
				return false 
			})
			// 按照 topFolderPath 创建 topFolder 文件夹成功
			noticeAndLog(`未找到路径: "${this.settings.topFolderPath}" 对应的文件夹, 已自动创建`)
		}
		// 🔴1.3 内容：当前目录下不得包含任何非文件夹的文件
		for (var child of this.app.vault.getAbstractFileByPath(this.settings.topFolderPath).children) {		// child为topFolder下的子文件
			if (child.name.indexOf(".") != -1) {
				noticeAndLog(`${this.settings.topFolderPath} 路径下不得包含任何非文件夹的文件`)
				return false
			}
		}

		// 2 获取所有的MOCPages
		var MOCPages = this.getAllMOCFiles()	// 该函数会自动创建MOC对应的专属文件夹，并自动检查和修正templatesFolderPath
		
		// 3 MOC专属文件夹
		// 🔴3.1 对应MOC：是否都有对应MOC
		// 🔴3.2 内容：当前目录下不得包含任何非文件夹的文件，且当前目录下的所有文件夹均被认为是项目文件夹
		for (var child of this.app.vault.getAbstractFileByPath(this.settings.topFolderPath).children) {		// child为topFolder下的子文件：MOC专属文件夹
			// 判断每个MOC文件夹是否有对应MOC
			var hasMOC = false
			for (var MOCPage of MOCPages) {
				if(child.name == MOCPage.tFile.basename) {
					hasMOC = true
					break
				}
			}
			// 若无对应MOC
			if (!hasMOC) {
				noticeAndLog(`未找到路径为: ${child.path} 的文件夹对应的名为: ${child.name} 的MOC文档，请检查是否有MOC文档或MOC文档是否设置正确`)
				return false
			}
			// 判断每个MOC文件夹下是否包含任何非文件夹的文件
			for (var subChild of child.children) {		// subChild为MOC专属文件夹的子文件
				if (subChild.name.indexOf(".") != -1) {
					noticeAndLog(`${child.path} 路径下不得包含任何非文件夹的文件`)
					return false
				}
			}
		}

		// 4 项目文件夹
		// 🟡4.1 内容：这里面什么都可以放，但就是不能把当前项目所属的MOC文档放在里面。会将MOC文档直接移动到根目录并提示
		// 🟡4.2 内容：应包含入口文档，没有则创建
		for (var child of this.app.vault.getAbstractFileByPath(this.settings.topFolderPath).children) {		// child为topFolder下的子文件：MOC专属文件夹
			for (var subChild of child.children) {		// subChild为MOC专属文件夹的子文件：项目文件夹
				for (var MOCPage of MOCPages) {
					// 获取当前项目所属的MOC
					if(child.name == MOCPage.tFile.basename) {
						// 判断当前项目所属的MOC文档是否在该项目中
						if (MOCPage.tFile.path.indexOf(subChild.path) != -1) {
							// 将MOC文档直接移动到根目录并提示
							this.app.vault.rename(MOCPage.tabstractFile, MOCPage.tFile.name)
							noticeAndLog(`路径: ${subChild.path} 对应的项目文件夹下不得包含当前项目所属的MOC文档，已将该MOC文档移动到根目录`)
						}
						// 检查是否包含入口文档，没有则使用模板创建
						if (!this.app.vault.getAbstractFileByPath(`${subChild.path}/${subChild.name}.md`)) {
							this.app.vault.create(`${subChild.path}/${subChild.name}.md`, MOCPage.itemTemplateStr)
							noticeAndLog(`未发现路径: ${subChild.path} 对应的项目文件夹下的入口文档: ${subChild.name}.md，已自动创建新的入口文档`)
						}
						break
					}
				}
			}
		}

		// 5 templatesFolderPath 
		// 5.1 设置：是否有值，无值则设置模板为看板模板；有值则继续检查
		// 🟡5.2 被设置的话是否有对应的文件夹，没有则自动创建并提醒
		// 5.3 该文件夹若存在 MOC-template.md 文件，没有则使用默认模板
		if (this.settings.templatesFolderPath) {
			if (!this.app.vault.getAbstractFileByPath(this.settings.templatesFolderPath)) {
				this.app.vault.createFolder(this.settings.templatesFolderPath)
				noticeAndLog(`未找到 "${this.settings.templatesFolderPath}", 已自动创建`)
			}
			if (this.app.vault.getAbstractFileByPath(`${this.settings.templatesFolderPath}/MOC-template.md`)) {
				this.app.vault.adapter.read(`${this.settings.templatesFolderPath}/MOC-template.md`).then(data => {
					this.MOCTemplateStr = data
				})
			}
			else {
				this.MOCTemplateStr = [
					"---", 
					"",
					"kanban-plugin: basic",
					"kanban-MOC: true",
					"",
					"---",
					"",
					"",
					"## 🗃️信息",
					"",
					"",
					"",
					"%% kanban:settings",
					"```",
					'{"kanban-plugin":"basic"}',
					"```",
					"%%",
				].join("\n")
			}
		}
		else {
			this.MOCTemplateStr = [
				"---", 
				"",
				"kanban-plugin: basic",
				"kanban-MOC: true",
				"",
				"---",
				"",
				"",
				"## 🗃️信息",
				"",
				"",
				"",
				"%% kanban:settings",
				"```",
				'{"kanban-plugin":"basic"}',
				"```",
				"%%",
			].join("\n")
		}


		return true
	}
	
}


class MOCPage{
	plugin: MyPlugin;
	name: string;
	MOCFolderPath: string;
	MOCPagePath: string;
	
	itemTemplateStr: string;
	items: Array<Item>;

	tFile: TFile;
	tabstractFile: TAbstractFile;
	
	/**
	 * MOCPage 构造函数
	 * @param plugin 
	 * @param tFile 使用 MOCPage 的除构造函数外的函数时必须确保该传入的MOC TFile正确！MOCPage 的其他函数不会对MOC TFile进行校验
	 */
	constructor (plugin: MyPlugin,tFile: TFile){
		this.plugin = plugin

		this.tFile = tFile
		this.tabstractFile = plugin.app.vault.getAbstractFileByPath(this.MOCPagePath)
		
		this.name = this.tFile.basename
		this.MOCPagePath = this.tFile.path
		this.MOCFolderPath = `${plugin.settings.topFolderPath}/${this.tFile.basename}`
		
		// MOC专属文件夹
		// 🟡检查是否有对应的MOC专属文件夹，没有则自动新建
		if (!plugin.app.vault.getAbstractFileByPath(this.MOCFolderPath)) {
			plugin.app.vault.createFolder(this.MOCFolderPath)
		}

		// templatesFolderPath 有值时检查该路径下是否有对应当前MOC的项目模板
		if (plugin.settings.templatesFolderPath) {
			if (plugin.app.vault.getAbstractFileByPath(`${plugin.settings.templatesFolderPath}/${this.tFile.basename}-template.md`)) {
				plugin.app.vault.adapter.read(this.tFile.path).then(data => {
					this.itemTemplateStr = data
				})
			}
			else {
				this.itemTemplateStr = ''
			}
		}
		else {
			this.itemTemplateStr = ''
		}

		this.updateIndex()
	}

	// ============================== MOC索引操作 ==============================
	/**
	 * 更新MOC索引（更新 items 并写入 MOC）
	 */
	updateIndex() {
		/**
		 * 所有项目的引用形式必须为：`[itemName](topFolderPath/MOCBaseName/itemName/itemName.md)`
		 * 只有以这种形式对项目入口文档索引（链接），才算作该文档被索引
		 */
		var shouldBeIndexedItemsPagePathList = new Array<string>()	// 应该被引用的项目入口文档路径的列表（通过MOC专属文件夹判断）
		var indexedItemsPagePathList = new Array<string>()			// 应该被引用且已经被引用的项目入口文档路径的列表（通过MOCPage的metadataCache判断）
		var notIndexedItemsPageLinkList = new Array<string>()		// 应该被引用但未被引用的项目入口文档的[]()形式链接的列表（通过MOC专属文件和MOCPage的metadataCache判断）

		// 清空项目
		this.items = []

		// 1 获取 shouldBeIndexedItemsPagePathList
		for (var child of this.plugin.app.vault.getAbstractFileByPath(this.MOCFolderPath).children){
			shouldBeIndexedItemsPagePathList.push(`${child.path}/${child.path.split("\n").pop()}.md`)
			this.items.push(new Item(this, child.path.split("\n").pop()))	// 添加项目
		}

		// 2 获取 indexedItemsPagePathList
		var MOCcache = this.plugin.app.metadataCache.getFileCache(this.tFile)
		if (MOCcache.hasOwnProperty("links")) {
			for (var link of MOCcache.links) {
				// 正则检查如果链接为[itemName](topFolderPath/MOCBaseName/itemName/itemName.md)的链接并检查该链接是否为对项目的链接
				if (/\[.*?\]\(.*?\)/.test(link.original) && shouldBeIndexedItemsPagePathList.indexOf(link.original) != -1) {
					indexedItemsPagePathList.push(link.original)
				}
			}
		}

		// 3 获取 notIndexedItemsPageLinkList
		for (var path of shouldBeIndexedItemsPagePathList) {
			if (indexedItemsPagePathList.indexOf(path) == -1) {
				notIndexedItemsPageLinkList.push(`[${path.split("/").pop()}](${path})`)
			}
		}

		// 最后，将应该被引用但未被引用的索引添加上去
		this.plugin.app.vault.adapter.read(this.tFile.path).then(async data => {
			var dataline = data.split("\n")
			dataline.splice(dataline.indexOf("---"), 1)
			var insertLocation = dataline.indexOf("---") + 1

			var newAddContent = '## 新增项目\n'

			// 若为看板，则在最左边一列添加卡片
			if (MOCcache.frontmatter.hasOwnProperty("kanban-plugin")) {
				for (var link of notIndexedItemsPageLinkList) {
					newAddContent = newAddContent + `- [ ] ${link}\n`
				}
			}
			// 若为普通文档，在最开头添加
			else {
				for (var link of notIndexedItemsPageLinkList) {
					newAddContent = newAddContent + `${link}\n`
				}
			}
			await this.plugin.app.vault.adapter.write(this.tFile.path, data.split("\n").splice(insertLocation, 0, newAddContent).join("\n"))
		})

	}
	/**
	 * 项目重命名或删除后 => 更新MOC索引（更新 items 并写入 MOC）
	 * @param itemName 
	 * @param newName 若操作为重命名，则赋值该参数；若操作为删除则留空
	 */
	updateIndexAfteRenameOrDeleteItem(itemName: string, newName: string = '') {
		/**
		 * 所有项目的引用形式必须为：`[itemName](topFolderPath/MOCBaseName/itemName/itemName.md)`
		 * 只有以这种形式对项目入口文档索引（链接），才算作该文档被索引
		 */
		var shouldBeIndexedItemsPagePathList = new Array<string>()	// 应该被引用的项目入口文档路径的列表（通过MOC专属文件夹判断）
		var indexedItemsPagePathList = new Array<string>()			// 应该被引用且已经被引用的项目入口文档路径的列表（通过MOCPage的metadataCache判断）
		var notIndexedItemsPageLinkList = new Array<string>()		// 应该被引用但未被引用的项目入口文档的[]()形式链接的列表（通过MOC专属文件和MOCPage的metadataCache判断）

		// 清空项目
		this.items = []

		// 1 获取 shouldBeIndexedItemsPagePathList
		for (var child of this.plugin.app.vault.getAbstractFileByPath(this.MOCFolderPath).children){
			shouldBeIndexedItemsPagePathList.push(`${child.path}/${child.path.split("\n").pop()}.md`)
			this.items.push(new Item(this, child.path.split("\n").pop()))	// 添加项目
		}

		// 2 获取 indexedItemsPagePathList
		var MOCcache = this.plugin.app.metadataCache.getFileCache(this.tFile)
		if (MOCcache.hasOwnProperty("links")) {
			for (var link of MOCcache.links) {
				// 正则检查如果链接为[itemName](topFolderPath/MOCBaseName/itemName/itemName.md)的链接并检查该链接是否为对项目的链接
				if (/\[.*?\]\(.*?\)/.test(link.original) && shouldBeIndexedItemsPagePathList.indexOf(link.original) != -1) {
					indexedItemsPagePathList.push(link.original)
				}
			}
		}

		// 3 获取 notIndexedItemsPageLinkList
		for (var path of shouldBeIndexedItemsPagePathList) {
			if (indexedItemsPagePathList.indexOf(path) == -1) {
				notIndexedItemsPageLinkList.push(`[${path.split("/").pop()}](${path})`)
			}
		}

		var item = new Item(this, itemName)
		// 最后，将应该被引用但未被引用的索引添加上去，并将已经删除的项目的链接替换掉
		this.plugin.app.vault.adapter.read(this.tFile.path).then(async data => {
			if (newName) {
				var newItem = new Item(this, newName)
				var dataline = data.replace(`[${item.name}](${item.itemPagePath})`, `[${newName}](${newItem.itemPagePath})`).split("\n")
			}
			else {
				var dataline = data.replace(`- [ ] [${item.name}](${item.itemPagePath})`, ``).replace(`[${item.name}](${item.itemPagePath})`, item.name).split("\n")
			}
			dataline.splice(dataline.indexOf("---"), 1)
			var insertLocation = dataline.indexOf("---") + 1

			var newAddContent = '## 新增项目\n'

			// 若为看板，则在最左边一列添加卡片
			if (MOCcache.frontmatter.hasOwnProperty("kanban-plugin")) {
				for (var link of notIndexedItemsPageLinkList) {
					newAddContent = newAddContent + `- [ ] ${link}\n`
				}
			}
			// 若为普通文档，在最开头添加
			else {
				for (var link of notIndexedItemsPageLinkList) {
					newAddContent = newAddContent + `${link}\n`
				}
			}
			await this.plugin.app.vault.adapter.write(this.tFile.path, data.split("\n").splice(insertLocation, 0, newAddContent).join("\n"))
		})

	}
	/**
	 * 获取索引项目的入口文档的路径列表（通过 items 获取）
	 */
	getIndexedItemsPathList() {

		this.updateIndex()		// 更新索引

		// 此时MOC专属文件夹已经和MOC索引链接对应了
		var shouldBeIndexedItemsPagePathList = new Array<string>()	// 应该被引用的项目入口文档路径的列表（通过MOC专属文件夹判断）

		for (var item of this.items) {
			shouldBeIndexedItemsPagePathList.push(item.itemPagePath)
		}
		return shouldBeIndexedItemsPagePathList
	}

	// ============================== MOC文件操作 ==============================
	/**
	 * 重命名MOC及其对应的文件夹
	 * @param newName 不会对名称格式进行校验！！
	 */
	async rename(newName: string) {
		// 重命名MOC文件
		await this.plugin.app.vault.rename(this.tabstractFile, `${this.tFile.parent.path}/${newName}.md`)
		// 重命名MOC专属文件夹
		await this.plugin.app.vault.rename(this.plugin.app.vault.getAbstractFileByPath(this.MOCFolderPath), `${this.plugin.settings.topFolderPath}/${newName}.md`)
		noticeAndLog(`MOC: ${this.name} 已更名为: ${newName}`)
	}
	/**
	 * 删除MOC及其对应的文件夹
	 */
	async delete() {
		// 删除MOC文档
		await this.plugin.app.vault.trash(this.tabstractFile, true)
		// 删除MOC文档
		await this.plugin.app.vault.trash(this.plugin.app.vault.getAbstractFileByPath(this.MOCFolderPath), true)
		noticeAndLog(`MOC文档及其对应文件夹: ${this.name} 已移动至系统回收站`)
	}

	// ============================== 项目文件操作 ==============================
	/**
	 * 新建项目及其对应的文件夹
	 * @param itemName 不会对名称格式进行校验！！
	 */
	createNewItem(itemName: string) {
		// 检查 itemName 项目是否存在
		var item = new Item(this, itemName)
		if (this.getIndexedItemsPathList().indexOf(item.itemPagePath) == -1) {
			this.plugin.app.vault.createFolder(item.itemFolderPath)
			this.plugin.app.vault.create(item.itemPagePath, this.itemTemplateStr)
			noticeAndLog(`项目: ${item.name} 已创建`)
			this.updateIndex()
		}
		else {
			noticeAndLog(`MOC: ${this.tFile.basename} 下已存在项目: ${item.name}`)
		}
	}
	/**
	 * 更改项目及其文件夹名称
	 * @param oldName 
	 * @param newName 不会对名称格式进行校验！！
	 */
	renameItem(oldName: string, newName: string) {
		// 检查 oldName 项目是否存在
		var item = new Item(this, oldName)
		if (this.getIndexedItemsPathList().indexOf(item.itemPagePath) != -1) {
			item.rename(newName)
			this.updateIndexAfteRenameOrDeleteItem(oldName, newName)
		}
		else {
			noticeAndLog(`未发现 ${this.tFile.basename} 文档对应的专属文件夹:${this.MOCFolderPath} 路径下有项目: ${oldName}`)
		}
	}
	/**
	 * 删除项目及其对应的文件夹
	 * @param itemName 
	 */
	deleteItem(itemName: string) {
		// 检查 oldName 项目是否存在
		var item = new Item(this, itemName)
		if (this.getIndexedItemsPathList().indexOf(item.itemPagePath) != -1) {
			item.delete()
			this.updateIndexAfteRenameOrDeleteItem(itemName)
		}
		else {
			noticeAndLog(`未发现 ${this.tFile.basename} 文档对应的专属文件夹:${this.MOCFolderPath} 路径下有项目: ${itemName}`)
		}
	}
}

/**
 * 项目
 */
class Item{
	MOCPage: MOCPage;
	name: string;
	itemFolderPath: string;
	itemPagePath: string;

	/**
	 * 项目入口文档对象
	 * @param MOCPage 
	 * @param itemName 使用 Item 的除构造函数外的函数时必须确保该项目名正确！Item 的其他函数不会对项目名称进行校验
	 */
	constructor(MOCPage: MOCPage, itemName: string) {
		this.MOCPage = MOCPage
		this.name = itemName
		this.itemFolderPath = `${MOCPage.MOCFolderPath}/${itemName}`
		this.itemPagePath = `${MOCPage.MOCFolderPath}/${itemName}/${itemName}.md`
	}

	/**
	 * 重命名项目及其对应的文件夹
	 * @param newName  不会对名称格式进行校验！！
	 */
	async rename(newName: string) {
		// 检查新名称是否已有项目存在
		var newItem = new Item(this.MOCPage, newName)
		if (this.MOCPage.getIndexedItemsPathList().indexOf(newItem.itemPagePath) == -1) {
			// 重命名项目文件
			await this.MOCPage.plugin.app.vault.rename(this.MOCPage.plugin.app.vault.getAbstractFileByPath(this.itemPagePath), `${this.itemFolderPath}/${newName}.md`)		
			// 重命名项目文件夹
			await this.MOCPage.plugin.app.vault.rename(this.MOCPage.plugin.app.vault.getAbstractFileByPath(this.itemFolderPath), `${this.MOCPage.MOCFolderPath}/${newName}`)	
			noticeAndLog(`项目: ${this.name} 已更名为: ${newName}`)
		}
		else {
			noticeAndLog(`${this.MOCPage.tFile.basename} 中已存在项目: ${newName}`)
		}
	}

	/**
	 * 删除项目及其对应的文件夹
	 */
	async delete() {
		// 删除项目文件夹
		await this.MOCPage.plugin.app.vault.trash(this.MOCPage.plugin.app.vault.getAbstractFileByPath(this.itemFolderPath), true)
		noticeAndLog(`项目: ${this.name} 已移动至系统回收站`)
	}
}



// 新建文件面板
class myModal extends Modal {
	plugin: MyPlugin;
	folderName: string;
	cmdName: string;

	constructor(plugin: MyPlugin, cmdName: string) {
		/**path 为
		 */
		super(plugin.app);
		this.plugin = plugin;
		this.cmdName = cmdName;
	}

	onOpen(): void {

		if (this.plugin.checkSettings()) {
			switch(this.cmdName) {
				case "新建MOC文件": this.createNewMOC(); break;
				case "从该MOC新建项目": this.createItem("项目"); break;
				case "修改该项目名称": this.renameItem("项目");break;
				case "删除该项目": this.deleteItem("项目");break;
				default:
		   }
		}
		else this.close(); 
	}

	onClose(): void {
		// if (this.opType.indexOf("资源") != -1) {
		// 	setTimeout(() => {
		// 		this.plugin.updateMOC("资源");
		// 	}, 500)
		// }
		// else if (this.opType.indexOf("项目") != -1) {
		// 	setTimeout(() => {
		// 		this.plugin.updateMOC("项目");
		// 	}, 500)
		// }
	}

	// 新建MOC文件
	createNewMOC() {

		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`${this.cmdName}`);

		// 2、输入框
		var newItemName = contentEl.createEl("input")
		newItemName.placeholder = "新MOC的名称";
		newItemName.setAttrs({
			"class": "kanbanMOC",
		});

		// 3、按钮
		var creatButton = contentEl.createEl("button");
		creatButton.setText("   确定   ");
		creatButton.setAttrs({
			"class": "kanbanMOC",
		});

		// ============ 执行操作 ============
		var modal = this

		function executeCreateNewMOC(modal: ItemModal) {
			if (!modal.plugin.isMarkdownNameRepeated(newItemName.value)) {
				modal.plugin.app.vault.create(newItemName.value, modal.plugin.MOCKanbanTemplate)
			}
		}

		newItemName.onsubmit = function(){
			executeCreateNewMOC(modal)
		}
		creatButton.onclick = function(){
			executeCreateNewMOC(modal)
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
					plugin.app.vault.adapter.read(`${plugin.settings.templatesFolder}/${folderName}-模板.md`).then(data => {
						plugin.app.vault.create(
							`${plugin.settings.topFolder}/${folderName}/${newItemName.value}/${newItemName.value}.md`,
							data,
						)
						noticeAndLog(`已成功${opType}：${newItemName.value}`)
						modal.close()
					})
				}
				else {
					noticeAndLog("新名称和其它文档重名，请重新输入。\n⚠️入口文档最好不要同任何文档重名！！！");
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
					noticeAndLog(`已成功${opType}：${plugin.clickFile.basename} => ${newItemName2.value}`)
					modal.close()
				}
				else {
					noticeAndLog("新名称和其它文档重名，请重新输入。\n⚠️入口文档最好不要同任何文档重名！！！");
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
				noticeAndLog(`已成功${opType}：${plugin.clickFile.basename}`)

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
						plugin.app.vault.adapter.write(`${plugin.settings.resMOCfileName}.md`, result).then(data => {
							noticeAndLog("资源索引更新完成")
							modal.close()
						})
					}
					else if (opType.indexOf("项目") != -1) {
						plugin.app.vault.adapter.write(`${plugin.settings.prjMOCfileName}.md`, result).then(data => {
							noticeAndLog("项目索引更新完成")
							modal.close()
						})
					}
	
				});

			}else{
				noticeAndLog("请手动输入：确认删除")
			}
		}
	}
}

// 插件设置页面
class SettingTab extends PluginSettingTab {
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
		containerEl.createEl('a', {text: "插件演示库", 'href': "https://github.com/1657744680/obsidian-Kanban-MOC-demo"})

		// 新建一个设置选项
		new Setting(containerEl)
			.setName('总文件夹路径')
			.setDesc('💡说明：该文件夹会存放你在MOC中创建的所有项目。\n若写：AllFiles，则在新建项目时\n将在 `Allfiles/MOC文档名` 路径下创建新项目')
			.addText(text => text
				.setPlaceholder('例如 AllFiles')
				.setValue(this.plugin.settings.topFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.topFolderPath = value;
					await this.plugin.saveSettings();
				}));

		// 新建一个设置选项
		new Setting(containerEl)
			.setName('项目入口文档模板文件夹路径')
			.setDesc('💡说明：例如我想为名称为“xx.md”的MOC文件设置一个新建项目时用到的模板，则需要在模板文件夹下建立一个名为“xx-template.md”的文档')
			.addText(text => text
				.setPlaceholder('例如 AllFiles/templates')
				.setValue(this.plugin.settings.templatesFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.templatesFolderPath = value;
					await this.plugin.saveSettings();
				})
			);
		
	}
}

