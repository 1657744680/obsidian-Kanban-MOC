import { appendFile, fstat, readFile, rename, writeFile } from 'fs';
import { App, Editor, MarkdownView,SearchComponent,Vault, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceItem, Menu, TFile, MenuItem, TAbstractFile, LinkCache} from 'obsidian';
import { isAbsolute } from 'path';
import * as path from 'path/posix';

/**
 * MOCSettings
 */
interface MOCSettings {
	templatesFolderPath: string;
}
/**
 * 定义默认设置 MOCSettings
 */
const DEFAULT_SETTINGS: MOCSettings = {
	templatesFolderPath: '',
}

/**
 * 通知并打印消息
 * @param message 消息
 */
function myNotice(message: string) {
	console.log(`MOC-plugin:\n${message}`)
	new Notice(message)
}

/**
 * 插件
 */
export default class MOCPlugin extends Plugin { 
	settings: MOCSettings
	name: string
	MOCTemplate: string
	attachmentsFolderName: string

	/**
	 * 加载插件
	 */
	async onload() {
		// 初始化
		await this.loadSettings();
		this.addSettingTab(new SettingTab(this.app, this));

		// 自定义
		// console.log(this.app.vault.getAbstractFileByPath("AllFiles/测试")) 
		// console.log(this.app.vault.adapter.exists("AllFiles/测试/.MOC"))
		// console.log(this.app.metadataCache.getCache("测试.md"))
		// this.getAllMOCFolders()
		this.getAllMOCPages()
		
		this.addCommand({
			'id': 'createNewMOC', 
			'name': '新建MOC',
			callback: async () => {
				
			}
		})

		
		// ========================== 监听事件 ========================== 
		/**
		 * file-menu 文档菜单监听
		 * 	if MOCPage or MOC文件夹：
		 * 		添加选项：重命名MOC：弹出面板操作			otherInfo：MOCName
		 * 		添加选项：删除MOC：弹出面板操作				otherInfo：MOCName\n要输出的警告信息
		 * 		添加选项：新建项目：弹出面板操作			otherInfo：MOCName
		 * 	else if 入口文档 or 项目文件夹:
		 * 		添加选项：重命名项目：弹出面板操作			otherInfo：ItemFolderPath
		 * 		添加选项：移动项目到另一个MOC：弹出面板操作	otherInfo：ItemFolderPath
		 * 		添加选项：删除项目：弹出面板操作			otherInfo：ItemFolderPath\n要输出的警告信息
		 */
		 this.registerEvent(this.app.workspace.on("file-menu", async (menu, file) => {
			 
		}))
		/**
		 * rename 监听
		 * rename 包括移动在内！！
		 * 不能进行 this.isReady() 的判断，否则会逻辑错误无法运行！！
		 * 	if topFolder：			提醒：自动重新赋值设置并保存
		 * 	else if templatesFolder	提醒：自动重新赋值设置并保存
		 * 	else if MOCPage：		提醒：先还原MOC名称，弹出输入面板使用命令进行修改
		 * 	else if MOC文件夹		提醒：自动重命名对应文件
		 * 	else if 入口文档：		提醒：自动重命名对应文件夹
		 * 	else if 项目文件夹		提醒：自动重命名对应文件
		 */
		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			
		}))
		
	}
	/**
	 * 卸载插件
	 */
	onunload() {

	}
	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	// ========================== MOC获取 ========================== 
	/**
	 * 获取所有MOC文件
	 * @description 通过 metadataCache
	 * @returns 
	 */
	async getAllMOCPages(): Promise<Array<MOCPage>> {
		this.attachmentsFolderName = this.app.vault.config.attachmentFolderPath.replace("./", '')
		var AllMOCPages: Array<MOCPage> = new Array()
		for (var file of this.app.vault.getMarkdownFiles()) {
			var cahe = this.app.metadataCache.getCache(file.path)
			if (cahe.hasOwnProperty("frontmatter")) {
				if (cahe.frontmatter.hasOwnProperty("MOC-plugin")) {
					if (cahe.frontmatter["MOC-plugin"] == true) {
						// AllMOCPages.push(new MOCPage(this, file.path))
						await new MOCPage(this, file.path).update()
							.then(MOCPage => {
								if (MOCPage) {
									AllMOCPages.push(MOCPage)
								}
							})
					}
				}
			}
		}
		return AllMOCPages
	}
}


class MOCPage{
	vault: Vault
	path: string
	name: string
	parent: TAbstractFile
	children: Array<TAbstractFile>

	plugin: MOCPlugin
	baseName: string
	ItemPages: Array<ItemPage>
	itemTemplate: string
	tabStractFile: TAbstractFile

	constructor(plugin: MOCPlugin, MOCPagePath: string) {
		// this.update()
		this.plugin = plugin
		this.ItemPages = []
		this.init(MOCPagePath)
	}

	init(MOCPagePath: string){
		this.tabStractFile = this.plugin.app.vault.getAbstractFileByPath(MOCPagePath)

		this.vault = this.tabStractFile.vault
		this.path = this.tabStractFile.path
		this.name = this.tabStractFile.name
		this.parent = this.tabStractFile.parent
		this.children = this.tabStractFile.children
		
		this.baseName = this.tabStractFile.name.replace(".md", "")
	}

	async rename(newPagePath: string) {
		return await this.vault.rename(this.tabStractFile, newPagePath)
			.then(async () => { 
				new Notice(`MOC文档: ${this.path} => ${newPagePath}`)
				this.init(newPagePath)
				return true
			})
			.catch(reason => {
				myNotice(`移动MOC文档: ${this.baseName} 至新建MOC文件失败:\n${reason}`)
				return false
			})
	}

	async update() {
		await this.__updateItemTemplate()
		// 若无父文件夹
		if (this.parent.name != this.baseName) {
			await this.vault.createFolder(`${this.parent.path}/${this.baseName}`)
				.then(async () => {
					// console.log(`${this.path.replace(".md", '')}/${this.name}`)
					if (!await this.rename(`${this.path.replace(".md", '')}/${this.name}`)) {
						return false
					}
				})
				.catch(reason => {
					myNotice(`为无MOC文件夹的MOC文档: ${this.baseName} 创建新的MOC文件失败:\n${reason}`)
					return
				})
		}
		// 判断是否位于项目文件夹下 
		var Parent = this.parent
		while(Parent.path != '/') {
			// 如果有MOC文件夹的父文件夹有同名文档，则说明这个文件夹有可能是项目文件夹
			var isMOC = false
			if (this.vault.getAbstractFileByPath(`${Parent.parent}/${Parent.parent.name}.md`)) {
				// 判断文档的metadataCahe，若非MOC文档，那就是项目文档
				var cache = this.plugin.app.metadataCache.getCache(`${Parent.parent}/${Parent.parent.name}.md`)
				if (cache.hasOwnProperty("frontmatter")) {
					if (cache.frontmatter.hasOwnProperty("MOC-plugin")) {
						if (cache.frontmatter["MOC-plugin"] == true) {
							isMOC = true
						}
					}
				}
				if (!isMOC) {
					await this.vault.rename(this.parent, '/')
						.then(async () => {
							new Notice(`MOC文件夹不可位于项目文件夹中，已将MOC: ${this.baseName} 移动至根目录下`)
						})
						.catch(reason => {
							myNotice(`MOC文件夹: ${this.baseName} 移动至根目录失败:\n${reason}`)
							return
						})
				}
			}
			Parent = Parent.parent
		}
		for (var child of this.parent.children) {
			if (child.name != this.name) {
				// 当前文件夹下的文档：新建项目文件夹并移动该文档至项目文件夹
				if (child.name.indexOf(".md") != -1) {
					await this.vault.createFolder(`${this.parent.path}/${child.name.replace(".md", '')}`)
						.then(async () => {
							await this.vault.rename(child, `${this.parent.path}/${child.name.replace(".md", '')}/${child.name}`)
							.then(async () => {
								new Notice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 缺少项目文件夹，已自动创建并移动文档`)
							})
							.catch(reason => {
								myNotice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 移动至项目文件夹失败:\n${reason}`)
								return 
							})
						})
						.catch(reason => {
							myNotice(`为MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 创建项目文件夹失败:\n${reason}`)
							return 
						})
				}
				// 当前文件夹下的文件夹（除附件文件夹外）
				else if (child.name.indexOf(".") == -1 && child.name != this.plugin.attachmentsFolderName) {
					// 缺少入口文档
					if (!this.vault.getAbstractFileByPath(`${child.path}/${child.name}.md`)) {
						await this.vault.create(`${child.path}/${child.name}.md`, this.itemTemplate)
						.then(async () => {
							new Notice(`MOC: ${this.baseName} 下的项目文件夹: ${child.name} 缺少入口文档，已自动创建`)
						})
						.catch(reason => {
							myNotice(`为MOC: ${this.baseName} 下的项目文件夹: ${child.name} 创建缺少入口文档失败:\n${reason}`)
							return
						})
					}
				}
				// 当前文件夹下的文件（除了文档外的）
				else if (child.name.indexOf(".") != -1) {
					// 先判断附件文件夹是否存在: 若不存在则创建该文件夹
					if (!this.vault.getAbstractFileByPath(`${child.parent.path}/${this.plugin.attachmentsFolderName}`)) {
						await this.vault.createFolder(`${child.parent.path}/${this.plugin.attachmentsFolderName}`)
					}
					await this.vault.rename(child, `${child.parent.path}/${this.plugin.attachmentsFolderName}/${child.name}`)
						.then(async () => {
							new Notice(`MOC: ${this.baseName} 下的非文档文件: ${child.name} 已移动至附件文件夹内`)
						})
						.catch(reason => {
							myNotice(`将MOC: ${this.baseName} 下的非文档和非文件夹文件: ${child.name} 移动至附件文件夹内失败:\n${reason}`)
							return
						})
				}
			}
		}
		// 自动获取所有项目
		this.ItemPages = []
		for (var child of this.parent.children) {
			// 非附件文件夹
			if (child.name != this.plugin.attachmentsFolderName && child.name.indexOf(".") == -1) {
				this.ItemPages.push(new ItemPage(this.plugin, `${child.path}/${child.name}.md`))
			}
		}
		// 更新MOC索引
		var indexedItems: Array<ItemPage> = new Array()
		var MOCCache = this.plugin.app.metadataCache.getCache(this.path)
		var content = await this.vault.adapter.read(this.path)
		if (MOCCache.hasOwnProperty("links")) {
			for (var link of MOCCache.links) { 
				var existItem = false
				// 判断 link.link 的形式为：itemName/itemName.md
				if (link.link.split("/").length == 2) {
					if (link.link.split("/")[0] == link.link.split("/")[1].replace(".md", "")) {
						// 获取新增未被索引的项目
						for (var itemPage of this.ItemPages) {
							if (link.link == itemPage.path.replace(`${itemPage.parent.parent.path}/`, '')) {
								existItem = true
								indexedItems.push(itemPage)
							}
						}
						// 若这种形式的链接对应的项目不存在，则删除该链接的卡片或进行替换
						content.replace(`- [ ] ${link.original}\n`, '').replace(`${link.original}`, ` ${link.link.split("/")[1]} `)
					}
				}
			}
		}
		// 为MOC添加索引
		var notIndexedItems: Array<ItemPage> = new Array()
		var newContent = '\n'
		for (var itemPage of this.ItemPages) {
			var indexed = false
			for (var indexedItem of indexedItems) {
				if (indexedItem.path == itemPage.path) {
					indexed = true
					break
				}
			}
			if (!indexed) {
				notIndexedItems.push(itemPage)
				// 一律当做文档是看板进行处理，并将未索引文档链接添加进MOC文档
				var path = itemPage.path.replace(`${itemPage.parent.parent.path}/`, '')
				while (path.indexOf(" ") != -1) {
					path = path.replace(" ", '%20')
				}
				newContent = newContent + `- [ ] [${itemPage.baseName}](${path})\n`
			}
		}
		var contentLines = content.split("\n")
		var insertLineNumber = 0
		if (content.indexOf("\n## ") != -1) {		// 如果有二级标题，插在第一个二级标题后面
			for (var no = 0; no < contentLines.length; no++) {
				if (contentLines[no].startsWith('## ')) {
					insertLineNumber = no + 1
					break
				}
			}
			contentLines.splice(insertLineNumber, 0, newContent) 
		}
		else {		// 无二级标题则新建一个，插入到 --- 后
			for (var no = 0; no < contentLines.length; no++) {
				if (contentLines[no] == '---' && !insertLineNumber) {
					insertLineNumber = 1
				}
				else if (contentLines[no] == '---' && insertLineNumber) {
					insertLineNumber = no + 1
					break
				}
			}
			contentLines.splice(insertLineNumber, 0, `\n## 新增索引项目${newContent}`) 
		}

		// 写入
		// console.log(contentLines.join('\n')) 
		await this.vault.adapter.write(this.path, contentLines.join('\n'))

		return this
	}

	// 项目模板获取
	/**
	 * @private
	 */
	async __updateItemTemplate() {
		this.itemTemplate = ''
		if (this.plugin.settings.templatesFolderPath) {
			if (this.vault.getAbstractFileByPath(`${this.plugin.settings.templatesFolderPath}/${this.baseName}-template.md`)) {
				this.itemTemplate = await this.vault.adapter.read(`${this.plugin.settings.templatesFolderPath}/${this.baseName}-template.md`)
			}
		}
	} 

	moveToAnotherMOC() {

	}
}

class ItemPage{
	vault: Vault
	path: string
	name: string
	parent: TAbstractFile
	children: Array<TAbstractFile>

	plugin: MOCPlugin
	baseName: string
	MOCPage: MOCPage
	
	constructor(plugin: MOCPlugin, itemPagePath: string) {
		var ItemPage = plugin.app.vault.getAbstractFileByPath(itemPagePath)
		
		this.vault = ItemPage.vault
		this.path = ItemPage.path
		this.name = ItemPage.name
		this.parent = ItemPage.parent
		this.children = ItemPage.children

		this.plugin = plugin
		this.baseName = ItemPage.name.replace(".md", "")
		this.MOCPage = new MOCPage(plugin, `${this.parent.parent.path}/${this.parent.parent.path.split('/').pop()}.md`)
	}

	/**
	 * 移动至另一个MOC
	 * @param anotherMOCPagePath 移动的目标MOCPage路径
	 */
	async moveToAnotherMOC(anotherMOCPagePath: string) {
		// 检查是否有为MOC
		var cache = this.plugin.app.metadataCache.getCache(anotherMOCPagePath)
		if (cache.hasOwnProperty("frontmatter")) {
			if (cache.frontmatter.hasOwnProperty("MOC-plugin")) {
				if (cache.frontmatter["MOC-plugin"] == true) {
					// 检查是否有重复文件
					for (var child of this.vault.getAbstractFileByPath(anotherMOCPagePath).parent.children) {
						if (child.name == this.baseName) {
							new Notice(`MOC: ${anotherMOCPagePath} 下已存在同名项目，可修改名称后再进行移动`)
							return false
						}
					}
					return await this.vault.rename(this.parent, `${this.vault.getAbstractFileByPath(anotherMOCPagePath).parent.path}/${this.baseName}`)
						.then(() => {
							new Notice(`项目文档及其文件夹: ${this.baseName} 已移动至MOC: ${anotherMOCPagePath} 下`)
							return true
						})
						.catch((reason) => {
							myNotice(reason)
							return false
						})
				}
			}
		}
		new Notice(`不存在该MOC: ${anotherMOCPagePath}`)
		return false
	}
}


/**
 * 插件设置标签页
 */
class SettingTab extends PluginSettingTab {
	plugin: MOCPlugin;

	constructor(app: App, plugin: MOCPlugin) {
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
		containerEl.createEl('div').setText("💡说明")
		containerEl.createEl('div').setText("1、为新建的MOC设置一个模板: 则在模板文件夹下新建一个名为“MOC名称-template.md”的文档")
		containerEl.createEl('div').setText("2、为某个MOC新建的项目设置一个模板: 则在模板文件夹下新建一个名为“MOC名称-template.md”的文档")
		

		// 新建一个设置选项
		new Setting(containerEl)
			.setName('模板文件夹路径')
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

