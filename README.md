自己开发的插件：[1657744680/obsidian-Kanban-MOC: 自用插件 (github.com)](https://github.com/1657744680/obsidian-Kanban-MOC)

详情见展示库：[1657744680/obsidian-Kanban-MOC-demo: 看板MOC插件的演示库 (github.com)](https://github.com/1657744680/obsidian-Kanban-MOC-demo)

我在官方示例库的ts文件写了点注释（不一定对），解压后npm run dev：[带注释的官方库](https://github.com/1657744680/obsidian-plugin)

# 前言

- 我个人平时喜欢用看板来管理资源和项目，但是手动添加索引和文件夹、文件什么的不太方便。所以就想做成快速命令辅助管理MOC索引。
- 开始是用python做的，因为不太懂js，也发了[帖子](https://forum-zh.obsidian.md/t/topic/2506?u=%E6%88%91%E6%83%B3%E5%81%9A%E4%B8%80%E6%9D%A1%E5%92%B8%E9%B1%BC)
- 后来看了看obsidian的开发例程，照猫画虎的做了个自己的插件，发个贴记录一哈。

用到的其它社区插件：Kanban、Dataview（可选）、Buttons（可选）

- 因为是个人使用的插件，所以说不一定适合于其他人。

开发教程等详情见展示库：[1657744680/obsidian-Kanban-MOC-demo: 看板MOC插件的演示库 (github.com)](https://github.com/1657744680/obsidian-Kanban-MOC-demo)
**里面会详细讲下如何开发一个简单的插件，以及演示我这个插件的使用。**

# 放几张演示库预览图
资源MOC
![image](https://user-images.githubusercontent.com/39726621/146632899-20c81ace-b220-42fd-9f01-cf98540cd396.png)

项目MOC
![image](https://user-images.githubusercontent.com/39726621/146632906-d05992d2-016f-4ade-aeb8-e6900059718d.png)

点进去obsidian看板MOC插件，其中的相关资源项目和未引用文档是通过DataviewJs实现的
![image](https://user-images.githubusercontent.com/39726621/146632931-b469ece4-ed83-4c2c-a762-724a10154435.png)

一共7条命令（已经改成2条命令和2个菜单选项了）：
![image](https://user-images.githubusercontent.com/39726621/146632996-5475df85-60f2-4ddb-9d26-3cf3ff6bac5c.png)

安装Buttons的话，就可以设置调用命令的按钮以便快速调用命令：
![image](https://user-images.githubusercontent.com/39726621/146632969-38a27ca1-b8cc-43d2-979b-b891a8ad0aaf.png)

