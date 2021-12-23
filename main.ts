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
		this.update()

		this.addCommand({
			'id': 'convertMOC', 
			'name': '转换选中的空文档为MOC看板',
			checkCallback: (checking: boolean) => {
				var file = this.app.workspace.getActiveFile()
				var content = file.unsafeCachedData
				if (!content) {
					if (!checking) {
						this.app.vault.modify(file, this.MOCTemplate)
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

		
		// ========================== 监听事件 ========================== 
		/**
		 * rename 文档菜单监听
		 * 1、文档
		 * 		移动
		 * 			if MOCPage && oldPath中的父文件夹是该MOC文档的MOC文件夹
		 * 				还原：弹出面板提示MOC可通过移动MOC文件夹或右键命令进行移动
		 * 			else if 项目入口文档 （通过oldPath判断是原来是项目文件夹）
		 * 				还原：弹出面板提示项目可通过移动项目文件夹或右键命令进行移动
		 * 		重命名
		 * 			if (metadataCahe判断)MOC文档 && MOC文件夹名称 != MOC入口文档名称
		 * 				自动重命名MOC文件夹、弹出提示
		 * 			else if (oldPath判断)项目入口文档 && 项目文件夹名称 != 项目入口文档名称
		 * 				自动重命名项目文件夹、弹出提示
		 * 2、文件夹
		 * 		移动
		 * 			if MOC文件夹 && 移动至项目文件夹
		 * 				还原：不能移动MOC文件夹至另一个项目文件夹
		 * 			else if 项目文件夹（通过oldPath判断是原来是项目文件夹）
		 * 				还原：不能移动项目文件夹至另一个项目文件夹
		 * 		重命名
		 * 			if MOC文件夹 && MOC文件夹名称 != MOC入口文档名称
		 * 				自动重命名MOC文档、弹出提示
		 * 			else if 项目文件夹 && 项目文件夹名称 != 项目入口文档名称
		 * 				自动重命名MOC文档、弹出提示
		 * 		if templatesFolder
		 * 			自动赋值保存设置
		 * 3、finally 更新MOC
		 */
		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			// 1、文档
			if (file.path.endsWith(".md")) {
				// 移动
				if (file.path.split('/').pop() == oldPath.split('/').pop()) {
					// if MOCPage
					if (this.getAllMOCPagesPathList().indexOf(file.path) != -1) {
						// if oldPath中的父文件夹是该MOC文档的MOC文件夹
						if (oldPath.split("/").pop().replace(".md", '') == oldPath.split("/").splice(-2)[0]) {
							// 还原：弹出面板提示MOC可通过移动MOC文件夹或右键命令进行移动
							setTimeout(async () => {
								await this.app.vault.rename(file, oldPath)	
								new Notice(`MOC可通过移动MOC文件夹进行移动或右键命令进行移动`)
								return
							}, 500)
							return
						}
					}
					// else if 项目入口文档（通过oldPath判断是原来是项目文件夹）
					else if (oldPath.split("/").pop().replace(".md", '') == oldPath.split("/").slice(-2)[0]) {
						// 还原：弹出面板提示项目可通过移动项目文件夹或右键命令进行移动
						setTimeout(async () => {
							await this.app.vault.rename(file, oldPath)	
							new Notice(`项目可通过移动项目文件夹或右键命令进行移动`)
							return
						}, 500)
						return
					}
				}
				// 重命名
				else {
					// if MOCPage
					if (this.getAllMOCPagesPathList().indexOf(file.path) != -1) {
						// if MOC文件夹名称 != MOC入口文档名称
						if (!this.doesFileOrFolderHasTheSameName(file.path)) {
							// 自动重命名MOC文件夹、弹出提示
							setTimeout(async () => {
								await this.app.vault.rename(file.parent, `${file.parent.parent.path}/${file.name.replace(".md", '')}`)
									.then(() => {
										// new Notice(`自动重命名MOC文件夹`)
										return
									})
									.catch(async reason => {
										// 重命名文件夹失败、还原文档名称
										await this.app.vault.rename(file, oldPath)	
										new Notice(`重命名文件夹失败、还原文档名称`)
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
								await this.app.vault.rename(file.parent, `${file.parent.parent.path}/${file.name.replace(".md", '')}`)
									.then(() => {
										// new Notice(`自动重命名项目文件夹`)
										return
									})
									.catch(async reason => {
										// 重命名文件夹失败、还原文档名称
										await this.app.vault.rename(file, oldPath)	
										new Notice(`重命名文件夹失败、还原文档名称`)
										return
									})
							}, 500)
							return
						}
					}
				}
			}
			// 2、文件夹
			else if (file.path.indexOf(".") == -1) {
				// 移动
				if (file.path.split('/').pop() == oldPath.split('/').pop()) {
					// if MOC文件夹
					if (this.getAllMOCFoldersPathList().indexOf(file.path) != -1) {
						// if 移动至项目文件夹的路径下
						for (var ItemfolderPath of this.getAllItemFoldersPathList()) {
							if (file.path.startsWith(ItemfolderPath) && file.path.split('/').length > ItemfolderPath.split('/').length) {
								// 还原：不能移动MOC文件夹至另一个项目文件夹
								setTimeout(async () => {
									await this.app.vault.rename(file, oldPath)	
									new Notice(`不能移动MOC文件夹至另一个项目文件夹`)
								}, 500)
								return
							}
						} 
					}
					// else if 项目文件夹（通过oldPath判断是原来是项目文件夹）
					else if (this.doesFolderHasSpecialChild(file.path, `${oldPath.split('/').pop()}.md`)) {
						for (var ItemfolderPath of this.getAllItemFoldersPathList()) { 
							if (file.path.startsWith(ItemfolderPath) && file.path.split('/').length > ItemfolderPath.split('/').length) {
								// 还原：不能移动项目文件夹至另一个项目文件夹
								setTimeout(async () => {
									await this.app.vault.rename(file, oldPath)	
									new Notice(`不能移动项目文件夹至另一个项目文件夹`)
								}, 500)
								return
							}
						}
					}
				}
				// 重命名
				else {
					// if MOC文件夹
					if (this.getAllMOCFoldersPathList().indexOf(file.path) != -1) {
						// if MOC文件夹名称 != MOC入口文档名称
						if (!this.doesFileOrFolderHasTheSameName(file.path)) {
							// 自动重命名MOC文档
							var mocpage = this.doesFolderHasSpecialChild(file.path, `${oldPath.split("/").pop()}.md`)
							if (mocpage) {
								setTimeout(async ()=>{
									await this.app.vault.rename(mocpage,`${file.path}/${file.name}.md`)
										.then(() => {
											// new Notice(`自动重命名MOC文档`)
											return
										})
										.catch(async reason => {
											// 重命名文档失败、还原文档名称
											await this.app.vault.rename(file, oldPath)
											new Notice(`重命名文档失败、还原文档名称`)
											return
										})
								}, 500)
							}
							return
						}
					}
					// else if 项目文件夹（通过oldPath判断是原来是项目文件夹）
					else if (this.doesFolderHasSpecialChild(file.path, `${oldPath.split('/').pop()}.md`)) {
						// if 项目文件夹名称 != 项目入口文档名称
						if (!this.doesFileOrFolderHasTheSameName(file.path)) {
							// 自动重命名项目入口文档
							setTimeout(async ()=>{
								await this.app.vault.rename(this.app.vault.getAbstractFileByPath(`${file.path}/${oldPath.split("/").pop()}.md`), `${file.path}/${file.name}.md`)
									.then(() => {
										// new Notice(`自动重命名项目入口文档`) 
										return
									})
									.catch(async reason => {
										// 重命名文件夹失败、还原文档名称
										await this.app.vault.rename(file, oldPath)
										new Notice(`重命名文档失败、还原文档名称`)
										return
									})
							}, 500)
							return
						}
					}
				}
				// if templatesFolder
				if (oldPath == this.settings.templatesFolderPath) {
					this.settings.templatesFolderPath = file.path
					await this.saveSettings()
				}
			}
			// 3、finally 更新MOC
			setTimeout(() => {
				this.update()
			}, 1000)
		}))
		/**
		 * delete 监听
		 * 	文档
		 * 		if MOC文档
		 * 			弹出确认面板提示：删除整个MOC
		 * 		else if 项目入口文档
		 * 			弹出确认面板提示：删除整个项目
		 * 	文件夹
		 * 		if MOC文件夹
		 * 			弹出确认面板提示：删除整个MOC
		 * 		else if 项目文件夹
		 * 			弹出确认面板提示：删除整个项目
		 * 3、finally 更新MOC
		 * rename 包括移动在内！！
		 */
		this.registerEvent(this.app.vault.on("delete", async (file) => {
			// 有同名文件夹，说明是项目、MOC文档，提示删除整个文件夹
			if (file.path.endsWith('.md')) {
				if (file.path.split('/').pop().replace('.md', '') == file.path.split('/').splice(-2)[0]) {
					await this.app.vault.adapter.trashSystem(file.path.replace(`/${file.name}`, ''))
				}
			}
			setTimeout(() => {
				this.update()
			}, 1000)
		}))
		/**
		 * create 监听
		 * 	文档
		 * 		if 位于MOC文件夹一级目录 && 名称!=MOC文件夹
		 * 			自动创建项目文件夹并将文件移入项目文件夹、弹出提示
		 * 	文件夹
		 * 		if 位于MOC文件夹一级目录
		 * 			弹出确认面板提示：删除整个MOC
		 * 		else if 项目文件夹
		 * 			弹出确认面板提示：删除整个项目
		 * 3、finally 更新MOC
		 * rename 包括移动在内！！
		 */
		this.registerEvent(this.app.vault.on("create", async (file) => {
			// 有同名文档或者文件夹，说明是项目文件夹、文档或MOC文件夹、项目
			setTimeout(() => {
				this.update()
			}, 1000)
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
		// 模板文件MOCTemplate
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
		// 更新索引
		this.getAllMOCPages()
		// new Notice("MOC: 更新索引完成")
	}

	/**
	 * 获取所有MOC文件
	 * @description 通过 metadataCache
	 * @returns 
	 */
	async getAllMOCPages(): Promise<Array<MOCPage>> {
		this.attachmentsFolderName = this.app.vault.config.attachmentFolderPath.replace("./", '')
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
			var cahe = this.app.metadataCache.getCache(file.path)
			if (cahe.hasOwnProperty("frontmatter")) {
				if (cahe.frontmatter.hasOwnProperty("MOC-plugin")) {
					if (cahe.frontmatter["MOC-plugin"]) {
						pathList.push(file.path)
					}
				}
			}
		}
		return pathList
	}
	getAllMOCFoldersPathList() {
		var pathList: Array<string> = new Array()
		for (var MOCPagePath of this.getAllMOCPagesPathList()) {
			pathList.push(this.app.vault.getAbstractFileByPath(MOCPagePath).parent.path)
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

	async renamePage(newPagePath: string) {
		return await this.vault.rename(this.tabStractFile, newPagePath)
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
		return await this.vault.rename(this.parent, newFolderPath)
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

	async update() {
		await this.__updateItemTemplate()
		// 若无父文件夹
		if (this.parent.name != this.baseName) {
			await this.vault.createFolder(`${this.parent.path}/${this.baseName}`)
				.then(async () => {
					if (!await this.renamePage(`${this.path.replace(".md", '')}/${this.name}`)) {
						return false
					}
				})
				.catch(reason => {
					myNotice(`为无MOC文件夹的MOC文档: ${this.baseName} 创建新的MOC文件失败:\n${reason}`)
					return 
				})
		}
		// 判断是否位于项目文件夹下
		for (var itemFolderPath of this.plugin.getAllItemFoldersPathList()) {
			if (this.parent.path.startsWith(itemFolderPath) && this.parent.path.split('/').length > itemFolderPath.split('/').length) {
				new Notice(`MOC文件夹不可位于项目文件夹中`)
				if (!await this.renameFolder(this.baseName)) {
					return false
				}
			}
		} 
		/**
		 * 当前文件夹下的文档：
		 * 		有同名文件夹：
		 * 			该同名文件夹里有入口文档：名称后添加“-重复”移动该文档至项目文件夹
		 * 			该同名文件夹里无入口文档：移动该文档至项目文件夹
		 * 		无同名文件夹：新建项目文件夹并移动该文档至项目文件夹
		 * 当前文件夹下的文件夹（除附件文件夹外）
		 * 		缺少入口文档：
		 * 			有同名文档：移动同名文档至当前文件夹
		 * 			无同名文档：新建入口文档
		 * 当前文件夹下的文件（除了文档外的）：移动至附件文件夹（不存在则创建）
		 */
		for (var child of this.parent.children) {
			if (child.name != this.name) {
				// 当前文件夹下的文档：新建项目文件夹并移动该文档至项目文件夹
				if (child.name.indexOf(".md") != -1) {
					// 当前路径下有同名文件夹
					if (this.vault.getAbstractFileByPath(child.path.replace(".md", ''))) {
						// 该同名文件夹里有入口文档：名称后添加“-重复”移动该文档至项目文件夹
						if (this.vault.getAbstractFileByPath(`${child.path.replace(".md", '')}/${child.name}`)) {
							await this.vault.rename(child, `${child.path.replace(".md", '')}/${child.name.replace(".md", '')}-重复.md`)
							.then(async () => {
								// new Notice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 已移动至项目文件夹`)
							})
							.catch(reason => {
								myNotice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 移动至项目文件夹失败:\n${reason}`)
								return 
							}) 
						}
						// 该同名文件夹里无入口文档：移动该文档至项目文件夹
						else {
							await this.vault.rename(child, `${child.path.replace(".md", '')}/${child.name}`)
							.then(async () => {
								// new Notice(`MOC: ${this.baseName} 下的项目文档: ${child.name.replace(".md", '')} 已移动至项目文件夹`)
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
								await this.vault.rename(child, `${child.path.replace(".md", '')}/${child.name}`)
									.then(async () => {
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
					// 当前路径下有同名文档：移动同名文档至当前文件夹
					// 无同名文档：新建入口文档
					if (!this.vault.getAbstractFileByPath(`${child.path}/${child.name}.md`)) {
						if (this.vault.getAbstractFileByPath(`${child.path}.md`)) {
							await this.vault.rename(this.vault.getAbstractFileByPath(`${child.path}.md`), `${child.path}/${child.name}.md`)
								.then(async () => {
									// new Notice(`MOC: ${this.baseName} 下的项目入口文档: ${child.name.replace(".md", '')} 已移动至项目文件夹`)
								})
								.catch(reason => {
									myNotice(`MOC: ${this.baseName} 下的项目入口文档: ${child.name.replace(".md", '')} 移动至项目文件夹失败:\n${reason}`)
									return 
								})
						}
						else {
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
		/**
		 * 更新MOC索引
		 * 获取新增的未被索引的项目、删除失效的项目链接
		 */
		var indexedItems: Array<ItemPage> = new Array()
		var MOCCache = this.plugin.app.metadataCache.getCache(this.path)
		var content = await this.vault.adapter.read(this.path)
		if (MOCCache.hasOwnProperty("links")) {
			for (var link of MOCCache.links) { 
				var existItem = false
				// 是文档
				if (link.link.endsWith('.md')) {
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
						// 若这种形式的链接对应的项目不存在，则删除该链接的卡片或进行替换
					}
				}
			}
		}
		// 获取未被引用的项目
		var notIndexedItems: Array<ItemPage> = new Array()
		var newContent = '- [ ] ### 新增未索引项目\n'
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
		if (notIndexedItems.length) {
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
		containerEl.createEl('div').setText("1、为新建的MOC设置一个模板: 则在模板文件夹下新建一个名为“MOCTemplate.md”的文档")
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

