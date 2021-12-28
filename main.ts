import { appendFile, fstat, readFile, rename, writeFile } from 'fs';
import { App, Editor, MarkdownView,SearchComponent,Vault, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceItem, Menu, TFile, MenuItem, TAbstractFile, LinkCache, FileManager} from 'obsidian';
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
 * 监听打印消息
 * @param message 消息
 */
 function myNoticeListener(message: string) {
	console.log(`MOC-plugin:\n${message}`)
	// new Notice(message)
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
		// console.log(this.app.vault.getAbstractFileByPath('🕹️操作面板.md'))


		this.update()

		this.addCommand({
			'id': 'convertMOC', 
			'name': '转换选中的空文档为MOC看板',
			checkCallback:  (checking: boolean) => {
				var file = this.app.workspace.getActiveFile()
				var content = file.unsafeCachedData
				if (!content) {
					if (!checking) {
						this.updateTemplate()
							.then(() => {
								this.app.vault.modify(file, this.MOCTemplate)
							})
						setTimeout(() =>{
							this.getAllMOCPages()
						}, 1000)
					}
					return true
				}
			}
		})
		
		this.addCommand({
			'id': 'updateMOC', 
			'name': '更新索引',
			callback: async () => {
				this.update()
			}
		})

		
		this.registerEvent(
			this.app.workspace.on("file-menu", async (menu, file: TFile) => {
				// 1、文档
				if (file.path.endsWith(".md")) {
					// if MOCPage
					if (this.getAllMOCPagesPathList().indexOf(file.path) != -1) {
						menu.addItem((item: MenuItem) => {
							item.setTitle('移动至另一个MOC')
								.onClick(() => {
									new myModal(this, '移动至另一个MOC', file.path).open()
								})
						})
					}
					// else if 项目入口文档
					else if (this.getAllItemPagesPathList().indexOf(file.path) != -1) {
						menu.addItem((item: MenuItem) => {
							item.setTitle('移动至另一个MOC')
								.onClick(() => {
									new myModal(this, '移动至另一个MOC', file.path).open()
								})
						})
						menu.addItem((item: MenuItem) => {
							item.setTitle('⚠️删除该项目')
								.onClick(() => {
									new myModal(this, '删除该项目', file.path).open()
								})
						})
					}
				}
			}),
		);

		// ========================== 监听事件 ========================== 
		/**
		 * rename 文档菜单监听
		 * 1、文档
		 * 		重命名
		 * 			if (metadataCahe判断)MOC文档 && MOC文件夹名称 != MOC入口文档名称
		 * 				自动重命名MOC文件夹、弹出提示
		 * 				更新MOC
		 * 			else if (oldPath判断)项目入口文档 && 项目文件夹名称 != 项目入口文档名称
		 * 				自动重命名项目文件夹、弹出提示
		 * 				更新MOC
		 * 	if templatesFolder
		 * 		自动赋值保存设置
		 */
		// 问题：自动重命名不会自动更新库中的链接

		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			// 1、文档
			if (file.path.endsWith(".md")) {
				// 重命名
				if (file.path.split('/').pop() != oldPath.split('/').pop()) {
					// if MOCPage
					if (this.getAllMOCPagesPathList().indexOf(file.path) != -1) {
						// if MOC文件夹名称 != MOC入口文档名称
						if (!this.doesFileOrFolderHasTheSameName(file.path)) {
							// 自动重命名MOC文件夹、弹出提示
							setTimeout(async () => {
								await this.app.fileManager.renameFile(file.parent, file.parent.path.replace(file.parent.name, file.name.replace(".md", '')))
									.then(() => {
										// new Notice(`自动重命名MOC文件夹`)
										// 更新MOC
										setTimeout(() => {
											if (this.app.vault.getAbstractFileByPath(`${file.parent.path.replace(file.parent.name, file.name.replace(".md", ''))}/${file.name}`)) {
												new MOCPage(this, `${file.parent.parent.path}/${file.name.replace(".md", '')}/${file.name}`).update()
											}
										}, 3000)
										return
									})
									.catch(async reason => {
										// 重命名文件夹失败、还原文档名称
										await this.app.fileManager.renameFile(file, oldPath)	
										myNotice(`重命名文件夹失败、还原文档名称`)
										return
									})
							}, 500)
							return
						}
					}
					// else if 项目入口文档
					else if (oldPath.split('/').pop().replace('.md', '') == file.parent.name) {
						// if 项目文件夹名称 != 项目入口文档名称
						if (!this.doesFileOrFolderHasTheSameName(file.path)) {
							// 自动重命名项目文件夹、弹出提示
							setTimeout(async () => {
								await this.app.fileManager.renameFile(file.parent, `${file.parent.parent.path}/${file.name.replace(".md", '')}`)
									.then(() => {
										// new Notice(`自动重命名项目文件夹`)
										// 更新MOC
										setTimeout(() => {
											if (this.getAllMOCPagesPathList().indexOf(`${file.parent.parent.path}/${file.parent.parent.name}.md`) != -1) {
												new MOCPage(this, `${file.parent.parent.path}/${file.parent.parent.name}.md`).update()
											}
										}, 3000)
										return
									})
									.catch(async reason => {
										// 重命名文件夹失败、还原文档名称
										await this.app.fileManager.renameFile(file, oldPath)	
										myNotice(`重命名文件夹失败、还原文档名称`)
										return
									})
							}, 500)
							return
						}
					}
				}
			}
			// if templatesFolder
			if (oldPath == this.settings.templatesFolderPath) {
				this.settings.templatesFolderPath = file.path
				await this.saveSettings()
			}
			
		}))
		
		/**
		 * create 监听
		 * 	文档
		 * 		if 位于MOC文件夹一级目录 && 名称!=MOC文件夹
		 * 			finally 更新MOC
		 */
		this.registerEvent(this.app.vault.on("create", async (file) => {
			// 新创建文档位于MOC文件夹一级目录 && 名称!=MOC文件夹
			if (file.path.endsWith('.md')) {
				if (this.getAllMOCFoldersPathList().indexOf(file.parent.path) != -1 && file.name.replace('.md', '') != file.parent.name) {
					if (this.app.vault.getAbstractFileByPath(`${file.parent.path}/${file.parent.name}.md`)) {
						var template = await new MOCPage(this, `${file.parent.path}/${file.parent.name}.md`).updateTemplate()
						this.app.vault.adapter.write(file.path, template)
						setTimeout(() => {
							new MOCPage(this, `${file.parent.path}/${file.parent.name}.md`).update()
						}, 3000)
					}
				}
			}
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

	async update() {
		this.attachmentsFolderName = this.app.vault.config.attachmentFolderPath.replace("./", '')
		// 模板文件MOCTemplate
		await this.updateTemplate()
		// 更新索引
		this.getAllMOCPages()
		// new Notice("MOC: 更新索引完成")
	}
	async updateTemplate() {
		this.MOCTemplate = '---\n\nkanban-plugin: basic\nMOC-plugin: MOC\n\n---\n## 🗃️信息\n\n\n\n%% kanban:settings\n```\n{"kanban-plugin":"basic"}\n```\n%%'
		if (this.settings.templatesFolderPath) {
			if (this.app.vault.getAbstractFileByPath(`${this.settings.templatesFolderPath}/MOCTemplate.md`)) {
				this.MOCTemplate = await this.app.vault.adapter.read(`${this.settings.templatesFolderPath}/MOCTemplate.md`)
				// 判断 frontmatter
				var cacheOK = false
				var cahe = this.app.metadataCache.getCache(`${this.settings.templatesFolderPath}/MOCTemplate.md`)
				if (cahe.hasOwnProperty("frontmatter")) {
					if (cahe.frontmatter.hasOwnProperty("MOC-plugin")) {
						if (cahe.frontmatter["MOC-plugin"]) {
							cacheOK = true
						}
					}
				}
				if (!cacheOK) {
					var insertLineNumber = 0
					var contentLines = this.MOCTemplate.split('/n')
					for (var no = 0; no < contentLines.length; no++) {
						if (contentLines[no] == '---' && !insertLineNumber) {
							insertLineNumber = 1
						}
						else if (contentLines[no] == '---' && insertLineNumber) {
							insertLineNumber = no
							break
						}
					}
					if (insertLineNumber = 0) {
						contentLines.splice(insertLineNumber, 0, `---\nMOC-plugin: MOC\n---`)
						this.MOCTemplate = contentLines.join('\n')
					}
					else {
						contentLines.splice(insertLineNumber, 0, `MOC-plugin: MOC`)
						this.MOCTemplate = contentLines.join('\n')
					}
				}
			}
		}
	}

	/**
	 * 获取所有MOC文件
	 * @description 通过 metadataCache
	 * @returns 
	 */
	async getAllMOCPages(): Promise<Array<MOCPage>> {
		var AllMOCPages: Array<MOCPage> = new Array()
		for (var MOCPagePath of this.getAllMOCPagesPathList()) {
			await new MOCPage(this, MOCPagePath).update()
				.then(MOCPage => {
					if (MOCPage) {
						AllMOCPages.push(MOCPage)
					}
				})
		}
		return AllMOCPages
	}
	getAllMOCPagesPathList() {
		var pathList: Array<string> = new Array()
		for (var file of this.app.vault.getMarkdownFiles()) {
			if (file.parent.path != this.settings.templatesFolderPath) {
				var cache = this.app.metadataCache.getCache(file.path)
				if (cache) {
					if (cache.hasOwnProperty("frontmatter")) {
						if (cache.frontmatter.hasOwnProperty("MOC-plugin")) {
							if (cache.frontmatter["MOC-plugin"]) {
								pathList.push(file.path)
							}
						}
					}
				}
			}
		}
		return pathList
	}
	getAllMOCFoldersPathList() {
		var pathList: Array<string> = new Array()
		for (var MOCPagePath of this.getAllMOCPagesPathList()) {
			if (MOCPagePath.split('/').pop().replace(".md", '') == MOCPagePath.split('/').splice(-2)[0]) {
				pathList.push(this.app.vault.getAbstractFileByPath(MOCPagePath).parent.path)
			}
		}
		return pathList
	}
	getAllItemPagesPathList() {
		var pathList: Array<string> = new Array()
		var MOCPagesPathList = this.getAllMOCPagesPathList()
		for (var file of this.app.vault.getMarkdownFiles()) {
			if (file.basename == file.parent.name) {
				if (MOCPagesPathList.indexOf(file.path) == -1) {
					pathList.push(file.path)
				}
			}
		}
		return pathList
	}
	getAllItemFoldersPathList() {
		var pathList: Array<string> = new Array()
		for (var ItemPagePath of this.getAllItemPagesPathList()) {
			pathList.push(this.app.vault.getAbstractFileByPath(ItemPagePath).parent.path)
		}
		return pathList
	}
	
	/**
	 * 文档是否有同名父文件夹
	 * 
	 * 文件夹是否有同名子文档
	 * @param filePath
	 * @returns 返回null，或者同名的文档或文件夹TAbstractFile
	 */
	doesFileOrFolderHasTheSameName(filePath: string) {
		if (filePath.endsWith('.md')) {
			if (this.app.vault.getAbstractFileByPath(filePath).parent.name == filePath.split('/').pop().replace('.md', '')){
				return this.app.vault.getAbstractFileByPath(filePath).parent
			}
			else {
				return null
			}
		}
		else if (filePath.indexOf(".") == -1) {
			for (var child of this.app.vault.getAbstractFileByPath(filePath).children) {
				if (child.name == `${filePath.split('/').pop()}.md`){
					return child
				}
			}
			return null
		}
		return null
	}
	/**
	 * 一个文件夹中是否有某子项
	 * @param FolderPath 
	 * @param fileName 带后缀的文件名(文件夹不带后缀)
	 * @returns 返回null，或者指定名称的文档TAbstractFile
	 */
	doesFolderHasSpecialChild(FolderPath: string, fileName: string) {
		for (var child of this.app.vault.getAbstractFileByPath(FolderPath).children) {
			if (child.name == fileName){
				return child
			}
		}
		return null
	}

	// 检查名称是否符合格式
	checkNameFormat(name: string) {
		if (name){
			for (var cha of name){
				if ('.*"\\/<>:|?'.indexOf(cha) != -1){
					new Notice("命名不得出现以下字符: .*\"\\/<>:|?")
					return false
				}
			}
			return true
		}
		else return false;
	}
}


class MOCPage{
	vault: Vault
	fileManager: FileManager
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

		this.vault = this.plugin.app.vault
		this.fileManager = this.plugin.app.fileManager
		this.path = this.tabStractFile.path
		this.name = this.tabStractFile.name
		this.parent = this.tabStractFile.parent
		this.children = this.tabStractFile.children
		
		this.baseName = this.tabStractFile.name.replace(".md", "")
	}

	async renamePage(newPagePath: string) {
		// 重命名文档
		return await this.fileManager.renameFile(this.tabStractFile, newPagePath)
			.then(async () => { 
				// new Notice(`MOC文档: ${this.path} => ${newPagePath}`)
				this.init(newPagePath)
				return true
			})
			.catch(reason => {
				myNotice(`移动MOC文档: ${this.baseName} 失败:\n${reason}`)
				return false
			})
	}
	async renameFolder(newFolderPath: string) {
		return await this.fileManager.renameFile(this.parent, newFolderPath)
			.then(async () => { 
				// new Notice(`MOC文件夹: ${this.parent.path} => ${newFolderPath}`)
				this.init(`${newFolderPath}/${this.name}`)
				return true
			})
			.catch(reason => {
				myNotice(`移动MOC文件夹: ${this.baseName} 失败:\n${reason}`)
				return false
			})
	}

	async updateTemplate() {
		// ========================== 项目模板获取 ========================== 
		this.itemTemplate = ''
		if (this.plugin.settings.templatesFolderPath) {
			if (this.vault.getAbstractFileByPath(`${this.plugin.settings.templatesFolderPath}/${this.baseName}-template.md`)) {
				this.itemTemplate = await this.vault.adapter.read(`${this.plugin.settings.templatesFolderPath}/${this.baseName}-template.md`)
			}
		}
		return this.itemTemplate
	}

	async update() {
		await this.updateTemplate()

		// ========================== 检查并整理文件格式 ========================== 
		var fileOperation = false
		/** 
		 * 若MOC无父文件夹：
		 * 		在根目录新建MOC文件夹
		 * 		移动MOC文档到MOC文件夹
		 */
		if (this.parent.name != this.baseName) {
			await this.vault.createFolder(`${this.parent.path}/${this.baseName}`)
				.then(async () => {
					// 移动MOC文档至父文件夹
					if (!await this.renamePage(`${this.path.replace(".md", '')}/${this.name}`)) {
						return false
					}
					else {
						fileOperation = true
					}
				})
				.catch(reason => {
					myNotice(`为MOC文档: ${this.baseName} 创建新的MOC文件失败:\n${reason}`)
					return 
				})
		}
		/**
		 * 当前文件夹下的文档：
		 * 		有同名文件夹：
		 * 			同名文件夹中有入口文档：先在名称后添加-重复，再移动该文档至项目文件夹
		 * 			同名文件夹中无入口文档：移动该文档至项目文件夹
		 * 		无同名文件夹：新建项目文件夹并移动该文档至项目文件夹
		 * 当前文件夹下的文件夹（除附件文件夹外）
		 * 		缺少入口文档：
		 * 			有同名文档：移动同名文档至当前文件夹
		 * 			无同名文档：新建入口文档
		 * 当前文件夹下的文件（除了文档外的）：移动至附件文件夹（不存在则创建）
		 */
		for (var child of this.parent.children) {
			if (child.name != this.name) {
				// 当前文件夹下的文档：
				if (child.name.indexOf(".md") != -1) {
					// 有同名文件夹：移动该文档至项目文件夹
					if (this.vault.getAbstractFileByPath(child.path.replace(".md", ''))) {
						// 同名文件夹中有入口文档：移动该文档至项目文件夹并在名称后添加-重复
						if (this.vault.getAbstractFileByPath(`${child.path.replace(".md", '')}/${child.name}`)) {
							await this.fileManager.renameFile(child, `${child.parent.path}/${child.name.replace(".md", '')}-重复.md`)
								.then(async () => {
									await this.fileManager.renameFile(child, `${child.path.replace("-重复.md", '')}/${child.name}`)
										.then(async () => {
											// new Notice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 已移动至项目文件夹`)
											fileOperation = true
										})
										.catch(reason => {
											myNotice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 移动至项目文件夹失败:\n${reason}`)
											return 
										}) 
								})
								.catch(reason => {
									myNotice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 重命名失败:\n${reason}`)
									return 
								})
						}
						// 同名文件夹中无入口文档：移动该文档至项目文件夹
						else {
							await this.fileManager.renameFile(child, `${child.path.replace(".md", '')}/${child.name}`)
								.then(async () => {
									// new Notice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 已移动至项目文件夹`)
									fileOperation = true
								})
								.catch(reason => {
									myNotice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 移动至项目文件夹失败:\n${reason}`)
									return 
								})
						}
					}
					// 无同名文件夹：新建项目文件夹并移动该文档至项目文件夹
					else {
						await this.vault.createFolder(`${child.path.replace(".md", '')}`)
							.then(async () => {
								await this.fileManager.renameFile(child, `${child.path.replace(".md", '')}/${child.name}`)
									.then(async () => {
										fileOperation = true
										// new Notice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 缺少项目文件夹，已自动创建并移动文档`)
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
				}
				// 当前文件夹下的文件夹（除附件文件夹外）
				else if (child.name.indexOf(".") == -1 && child.name != this.plugin.attachmentsFolderName) {
					// 缺少入口文档
					if (!this.vault.getAbstractFileByPath(`${child.path}/${child.name}.md`)) {
						// 有同名文档：移动同名文档至当前文件夹
						if (this.vault.getAbstractFileByPath(`${child.path}.md`)) {
							await this.fileManager.renameFile(this.vault.getAbstractFileByPath(`${child.path}.md`), `${child.path}/${child.name}.md`)
								.then(async () => {
									fileOperation = true
									// new Notice(`MOC: ${this.baseName} 下的项目入口文档: ${child.name.replace(".md", '')} 已移动至项目文件夹`)
								})
								.catch(reason => {
									myNotice(`MOC: ${this.baseName} 下的项目入口文档: ${child.name.replace(".md", '')} 移动至项目文件夹失败:\n${reason}`)
									return 
								})
						}
						// 无同名文档：新建入口文档
						else {
							await this.vault.create(`${child.path}/${child.name}.md`, this.itemTemplate)
								.then(async () => {
									fileOperation = true
									new Notice(`MOC: ${this.baseName} 下的项目文件夹: ${child.name} 缺少入口文档，已自动创建`)
								})
								.catch(reason => {
									myNotice(`为MOC: ${this.baseName} 下的项目文件夹: ${child.name} 创建缺少入口文档失败:\n${reason}`)
									return
								})
						}
					}
				}
				// 当前文件夹下的文件（除了文档外的）
				else if (child.name.indexOf(".") != -1) {
					// 先判断附件文件夹是否存在: 若不存在则创建该文件夹
					if (!this.vault.getAbstractFileByPath(`${child.parent.path}/${this.plugin.attachmentsFolderName}`)) {
						await this.vault.createFolder(`${child.parent.path}/${this.plugin.attachmentsFolderName}`)
							.then(() => {
								fileOperation = true
							})
					}
					await this.fileManager.renameFile(child, `${child.parent.path}/${this.plugin.attachmentsFolderName}/${child.name}`)
						.then(async () => {
							fileOperation = true
							new Notice(`MOC: ${this.baseName} 下的非文档文件: ${child.name} 已移动至附件文件夹内`)
						})
						.catch(reason => {
							myNotice(`将MOC: ${this.baseName} 下的非文档和非文件夹文件: ${child.name} 移动至附件文件夹内失败:\n${reason}`)
							return
						})
				}
			}
		}
		if (fileOperation) {
			setTimeout(async () => {
				await this.update()
			}, 500)
			return
		}

		// ========================== 项目获取与索引更新 ========================== 
		/**
		 * 自动获取所有项目
		 */
		this.ItemPages = []
		for (var child of this.parent.children) {
			// 非附件文件夹
			if (child.name != this.plugin.attachmentsFolderName && child.name.indexOf(".") == -1) {
				this.ItemPages.push(new ItemPage(this.plugin, `${child.path}/${child.name}.md`))
			}
		}
		/**
		 * 更新MOC索引
		 * 获取新增的未被索引的项目、删除失效的项目链接
		 * 		检查当前MOC的已链接项目文档
		 * 			删除、替换失效链接
		 * 			整理链接路径为相对路径
		 * 		获取未被引用的项目文档并处理成看板卡片的形式
		 * 更新索引
		 * 		如果有未被索引的项目的话：就处理新旧内容合并、内容插入的位置
		 * 写入MOC
		 */
		var indexedItems: Array<ItemPage> = new Array()
		var MOCCache = this.plugin.app.metadataCache.getCache(this.path)
		var content = await this.vault.adapter.read(this.path)
		if (MOCCache) {
			if (MOCCache.hasOwnProperty("links")) {
				for (var link of MOCCache.links) { 
					var existItem = false
					// 链接的对象是当前文件夹内的文档
					if (link.link.endsWith('.md') && !link.link.startsWith('../')) {
						// 判断 link.original 的形式为：[[]]
						if (link.original.endsWith(']]')) {
							// 1、判断 link.link 的形式为：itemName/itemName.md
							if (link.link.split("/").length == 2) {
								if (link.link.split("/")[0] == link.link.split("/")[1].replace(".md", "")) {
									// 获取新增未被索引的项目
									for (var itemPage of this.ItemPages) {
										if (link.link == itemPage.path.replace(`${itemPage.parent.parent.path}/`, '')) {
											existItem = true
											indexedItems.push(itemPage)
											break
										}
									}
									if (!existItem) {
										content = content
											.replace(`- [ ] ${link.original}\n`, '')
											.replace(`- [x] ${link.original}\n`, '')
											.replace(`${link.original}`, ` ${link.link.split("/")[1]} `)
									}
									// 若这种形式的链接对应的项目不存在，则删除该链接的卡片或进行替换
								}
							}
							// 2、判断 link.link 的形式为：itemName.md
							else if (link.link.split("/").length == 1 ) {
								// 获取新增未被索引的项目
								for (var itemPage of this.ItemPages) {
									if (link.link == itemPage.name) {
										existItem = true
										indexedItems.push(itemPage)
										break
									}
								}
								if (existItem) { 
									content = content.replace(link.original, `[${itemPage.baseName}](${itemPage.baseName}/${itemPage.name})`)
								}
								else {
									content = content
										.replace(`- [ ] ${link.original}\n`, '')
										.replace(`- [x] ${link.original}\n`, '')
										.replace(`${link.original}`, ` ${link.link.split("/")[1]} `)
								}
							}
						}
						// 判断 link.original 的形式为：[]()
						else {
							// 1、判断 link.link 的形式为：itemName/itemName.md
							if (link.link.split("/").length == 2) {
								if (link.link.split("/")[0] == link.link.split("/")[1].replace(".md", "")) {
									// 获取新增未被索引的项目
									for (var itemPage of this.ItemPages) {
										if (link.link == itemPage.path.replace(`${itemPage.parent.parent.path}/`, '')) {
											existItem = true
											indexedItems.push(itemPage)
											break
										}
									}
									if (!existItem) {
										content = content
											.replace(`- [ ] ${link.original}\n`, '')
											.replace(`- [x] ${link.original}\n`, '')
											.replace(`${link.original}`, ` ${link.link.split("/")[1]} `)
									}
									// 若这种形式的链接对应的项目不存在，则删除该链接的卡片或进行替换
								}
							}
							// 2、判断 link.link 的形式为：itemName.md
							else if (link.link.split("/").length == 1 ) {
								// 获取新增未被索引的项目
								for (var itemPage of this.ItemPages) {
									if (link.link == itemPage.name) {
										existItem = true
										indexedItems.push(itemPage)
										break
									}
								}
								if (existItem) { 
									content = content.replace(link.original, `[${itemPage.baseName}](${itemPage.baseName}/${itemPage.name})`)
								}
								else {
									content = content
										.replace(`- [ ] ${link.original}\n`, '')
										.replace(`- [x] ${link.original}\n`, '')
										.replace(`${link.original}`, ` ${link.link.split("/")[1]} `)
								}
							}
						}
					}
				}
			}
		}
		// 获取未被引用的项目文档并处理成看板卡片的形式
		var notIndexedItems: Array<ItemPage> = new Array()
		var newContent = ''
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
		// 如果有未索引的项目的话，就处理新旧内容合并、内容插入的位置
		if (newContent) {
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
			content = contentLines.join('\n')
		}
		// 写入
		await this.vault.adapter.write(this.path, content)

		return this
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
}

// 新建文件面板
class myModal extends Modal {
	plugin: MOCPlugin;
	folderName: string;
	cmdName: string;
	PagePath: string

	constructor(plugin: MOCPlugin, cmdName: string, PagePath: string) {
		/**path 为
		 */
		super(plugin.app);
		this.plugin = plugin;
		this.cmdName = cmdName;
		this.PagePath = PagePath
	}

	onOpen(): void {
		switch(this.cmdName) {
			case "移动至另一个MOC": this.moveToAnotherMOC(); break;
			case "删除该项目": this.deleteItem();break;
			default: break;
	   }
	}

	onClose(): void {
	}

	moveToAnotherMOC() {

		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`${this.cmdName}`);

		// 2、无刷新表单
		contentEl.createEl("iframe", {
			'attr': {
				'id': 'id_iframe',
				'name': 'id_iframe',
				'style': 'display:none',
			}
		})

		var form = contentEl.createEl("form", {
			'attr': {
				'target': 'id_iframe',
			}
		})

		var newItemName = form.createEl("input", {
			'attr': {
				"class": "kanbanMOC",
				'target': 'id_iframe',
				'type': 'text',
				"list": 'MOC'
			}
		})
		newItemName.placeholder = "MOC的文件夹路径";
		var searchResult = form.createEl("datalist", {
			"attr": {
				"id": "MOC"
			}
		})
		//模糊查询1:利用字符串的indexOf方法
		function searchByIndexOf(keyWord: string){
			var list = modal.plugin.getAllMOCFoldersPathList()
			
			var len = list.length;
			var arr = [];
			for(var i=0;i<len;i++){
				//如果字符串中不包含目标字符会返回-1
				if(list[i].toLowerCase().indexOf(keyWord.toLowerCase())>=0){
					arr.push(list[i]);
				}
			}
			return arr;
		}
		newItemName.oninput = function() {
			searchResult.empty()
			var list = searchByIndexOf(newItemName.value)
			if(!(list instanceof Array)){
				return ;
			}
			for(var i=0;i<list.length;i++){
				var item = document.createElement('option');
				item.innerHTML = list[i];
				searchResult.appendChild(item);
			}
		}

		form.createEl("input", {
			'attr': {
				"class": "kanbanMOC",
				'target': 'id_iframe',
				'type': 'submit',
				'value': '   确定    '
			}
		})

		// ============ 执行操作 ============
		var modal = this
		var vault = modal.app.vault

		form.onsubmit = function(){
			var file = vault.getAbstractFileByPath(modal.PagePath)
			// 检查是否为MOC文件夹
			if (modal.plugin.getAllMOCFoldersPathList().indexOf(newItemName.value) != -1) {
				var newMOCPagePath = `${newItemName.value}/${newItemName.value.split("/").pop()}.md`
				// 是MOCPage
				if (modal.plugin.getAllMOCPagesPathList().indexOf(modal.PagePath) != -1) {
					// 检查MOC路径是否不同当前MOC路径一致：
					if (newItemName.value != file.parent.path) {
						// 开始移动
						modal.app.fileManager.renameFile(file.parent, `${newItemName.value}/${file.parent.name}`)
						// 更新MOC
						var oldMOCPagePath = `${file.parent.parent.path}/${file.parent.parent.path.split("/").pop()}.md`
						setTimeout(() => {
							if (modal.plugin.getAllMOCPagesPathList().indexOf(newMOCPagePath) != -1) {
								new MOCPage(modal.plugin, newMOCPagePath).update()
							}
							if (modal.plugin.getAllMOCPagesPathList().indexOf(oldMOCPagePath) != -1) {
								new MOCPage(modal.plugin, oldMOCPagePath).update()
							}
						}, 1000)
						modal.close()
					}
					else {
						new Notice('请输入不同于当前MOC的路径')
					}
				}
				// 是项目入口文档
				else {
					// 检查MOC路径是否不同当前MOC路径一致：
					if (newItemName.value != file.parent.parent.path) {
						// 开始移动
						modal.app.fileManager.renameFile(file.parent, `${newItemName.value}/${file.parent.name}`)
						// 更新MOC
						var oldMOCPagePath = `${file.parent.parent.path}/${file.parent.parent.path.split("/").pop()}.md`
						setTimeout(() => {
							if (modal.plugin.getAllMOCPagesPathList().indexOf(newMOCPagePath) != -1) {
								new MOCPage(modal.plugin, newMOCPagePath).update()
							}
							if (modal.plugin.getAllMOCPagesPathList().indexOf(oldMOCPagePath) != -1) {
								new MOCPage(modal.plugin, oldMOCPagePath).update()
							}
						}, 1000)
						modal.close()
					}
					else {
						new Notice('请输入不同于当前MOC的路径')
					}
				}
			}
			else {
				new Notice('请输入正确的MOC文件夹路径')
			}
		}
	}

	deleteItem() {
		// ============ 面板界面 ============
		const {contentEl} = this;
		
		// 1、设置标题
		const title = this.titleEl
		title.setText(`⚠️ ${this.cmdName} ⚠️`);

		// 2、无刷新表单
		contentEl.createEl("iframe", {
			'attr': {
				'id': 'id_iframe',
				'name': 'id_iframe',
				'style': 'display:none',
			}
		})

		var form = contentEl.createEl("form", {
			'attr': {
				'target': 'id_iframe',
			}
		})

		var newItemName = form.createEl("input", {
			'attr': {
				"class": "kanbanMOC",
				'target': 'id_iframe',
				'type': 'text',
				"onpaste": "return false",
				"oncut": "return false"
			}
		})
		newItemName.placeholder = "请手动输入: 确认删除";

		form.createEl("input", {
			'attr': {
				"class": "kanbanMOC",
				'target': 'id_iframe',
				'type': 'submit',
				'value': '   确定    '
			}
		})

		// ============ 执行操作 ============
		var modal = this
		var vault = modal.app.vault

		form.onsubmit = async function(){
			if (newItemName.value == '确认删除') {
				var file = vault.getAbstractFileByPath(modal.PagePath)
				var MOCPagePath = `${file.parent.parent.path}/${file.parent.parent.name}.md`
				vault.trash(file.parent, true)
				new Notice(`已删除项目: ${file.parent.name}`)
				// 更新MOC
				setTimeout(() => {
					if (modal.plugin.getAllMOCPagesPathList().indexOf(MOCPagePath) != -1) {
						new MOCPage(modal.plugin, MOCPagePath).update()
					}
				}, 1000)
				modal.close()
			}
			else {
				new Notice(`请手动输入: 确认删除`)
			}
		}
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
		containerEl.createEl('div').setText("1、为新建的MOC设置一个模板: 则在模板文件夹下新建一个名为“MOCTemplate.md”的文档")
		containerEl.createEl('div').setText("2、为某个MOC新建的项目设置一个模板: 则在模板文件夹下新建一个名为“MOC名称-template.md”的文档")
		
		var list = new Array()
		for (var file of this.app.vault.getAllLoadedFiles()) {
			if (file.name.indexOf(".") == -1) {
				if (this.plugin.getAllMOCFoldersPathList().indexOf(file.path) == -1) {
					list.push(file.path)
				}
			}
		}

		containerEl.createEl("iframe", {
			'attr': {
				'id': 'id_iframe',
				'name': 'id_iframe',
				'style': 'display:none',
			}
		})

		var form = containerEl.createEl("form", {
			'attr': {
				'target': 'id_iframe',
			}
		})

		var newItemName = form.createEl("input", {
			'attr': {
				"class": "kanbanMOC",
				'target': 'id_iframe',
				'type': 'text',
				"list": 'MOC',
				'value': this.plugin.settings.templatesFolderPath,
				'style': 'width: 80%;'
			}
		})
		newItemName.placeholder = "模板文件夹路径";
		var searchResult = form.createEl("datalist", {
			"attr": {
				"id": "MOC"
			}
		})
		
		//模糊查询1:利用字符串的indexOf方法
		function searchByIndexOf(keyWord: string){
			
			var len = list.length;
			var arr = [];
			for(var i=0;i<len;i++){
				//如果字符串中不包含目标字符会返回-1
				if(list[i].toLowerCase().indexOf(keyWord.toLowerCase())>=0){
					arr.push(list[i]);
				}
			}
			return arr;
		}
		newItemName.oninput = function() {
			searchResult.empty()
			console.log(list)
			var list = searchByIndexOf(newItemName.value)
			if(!(list instanceof Array)){
				return ;
			}
			for(var i=0;i<list.length;i++){
				var item = document.createElement('option');
				item.innerHTML = list[i];
				searchResult.appendChild(item);
			}
		}

		form.createEl("input", {
			'attr': {
				"class": "kanbanMOC",
				'target': 'id_iframe',
				'type': 'submit',
				'value': '   确定    '
			}
		})

		var plugin = this.plugin
		form.onsubmit = async function(){
			plugin.settings.templatesFolderPath = newItemName.value;
			await plugin.saveSettings();
			new Notice('修改成功')
		}
		
	}
}

