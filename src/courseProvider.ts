import * as vscode from "vscode";
import { BrowserProvider } from "./browserProvider";
import { Locator, Page } from "playwright";
import { open } from "fs";
import { posix } from "path";
export class CourseProvider implements vscode.TreeDataProvider<TreeItem> {
    private browserProvider: BrowserProvider;

    constructor(browserProvider: BrowserProvider) {
        this.browserProvider = browserProvider;
    }

    registerTreeDataProvider(context: vscode.ExtensionContext) {
        vscode.window.registerTreeDataProvider("courses", this);
        const view = vscode.window.createTreeView("courses", {
            treeDataProvider: this,
        });
        context.subscriptions.push(view);
    }

    registerCommands(context: vscode.ExtensionContext) {
        const showCourses = vscode.commands.registerCommand(
            "weblab-vscode.showCourses",
            async () => {
                const courses = await this.getCourses();
                vscode.window.showInformationMessage(courses.join(", "));
            }
        );
        context.subscriptions.push(showCourses);
    }

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: TreeItem | undefined): Thenable<TreeItem[]> {
        if (element) {
            return element.getChildren(this.browserProvider);
        } else {
            return this.getCourses();
        }
    }

    async getCourses(): Promise<Course[]> {
        const username: string = await this.browserProvider.getUsername();

        const page = await this.browserProvider.getBrowserContext().newPage();
        await page.goto(`https://weblab.tudelft.nl/profile/${username}`, {
            waitUntil: "networkidle",
        });

        const courses: Course[] = [];
        const courseLocatorString: string = `#Dossier-Overview > #newajaxcontext > div[id^="ph_"]`;
        const courseLocators: Locator[] = await page
            .locator(courseLocatorString)
            .all();
        for (const courseLocator of courseLocators) {
            const courseId = (await courseLocator.getAttribute("id")) ?? "";
            const courseRootName: string = await courseLocator
                .locator("> div.row.assignment-row.root > div > a > strong")
                .innerText();
            const courseResult = new Course(
                courseRootName.trim(),
                courseLocatorString,
                courseId
            );
            courses.push(courseResult);
        }
        await page.close();
        return courses;
    }
}
abstract class TreeItem extends vscode.TreeItem {
    public link: string;
    constructor(
        public readonly label: string,
        link: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
            .TreeItemCollapsibleState.None,
        tooltip: string = ""
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.description = this.label;
        this.link = link;
    }

    getLocator() {
        return this.link;
    }

    abstract getChildren(browserManager: BrowserProvider): Promise<TreeItem[]>;
}

export class Assignment extends TreeItem {
    
    type: string;
    language: string | undefined;
    
    folderLocation: string;

    /**
     * Request data needed for submitting
     */
    postData: string | undefined;
    splitHeader: string | undefined;
    requestHeader: { [key: string]: string } | undefined;
    

    constructor(
        public readonly label: string,
        link: string,
        type: string,
        folderLocation: string = "",
        language?: string
    ) {
        super(label, link, vscode.TreeItemCollapsibleState.None, type);
        this.description = type;
        this.contextValue = "assignment";
        this.type = type;
        this.tooltip = link;
        this.folderLocation = folderLocation;
        this.command = {
            "title": "Open solution",
            "command": "weblab-vscode.openAssignment",
            "arguments": [this]
        };
        if(language) {
            this.language = language;
        }
    }
    getChildren(_browserManager: BrowserProvider): Promise<TreeItem[]> {
        return Promise.resolve([]);
    }

    saveSubmitData(postData: string, splitHeader: string, requestHeader: { [key: string]: string }) {
        this.postData = postData;
        this.splitHeader = splitHeader;
        this.requestHeader = requestHeader;
    }

    getSolutionUri(): vscode.Uri{
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showInformationMessage('No folder or workspace opened');
            throw new Error("No folder or workspace opened");
        }
        const folderUri = vscode.workspace.workspaceFolders[0].uri;
        const solutionFileName = this.getSolutionFileName();
        const solutionUri = folderUri.with({ path: posix.join(folderUri.path, this.folderLocation, solutionFileName) });
        return solutionUri;
    }

    getTestUri(): vscode.Uri{
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showInformationMessage('No folder or workspace opened');
            throw new Error("No folder or workspace opened");
        }
        const folderUri = vscode.workspace.workspaceFolders[0].uri;
        const testFileName = this.getTestFileName();
        const testUri = folderUri.with({ path: posix.join(folderUri.path, this.folderLocation, testFileName) });
        return testUri;
    }

    getSolutionFileName() {
        if(!this.language) {
            vscode.window.showWarningMessage("Incompatible programming language found, please report at: https://github.com/07joshua03/weblab-vscode/issues \n Falling back to .txt");
            return "solution.txt";
        } else if(this.language.toLowerCase().startsWith("java")) {
            return "Solution.java";
        } else if(this.language.toLowerCase().startsWith("python")) {
            return "solution.py";
        } else {
            vscode.window.showWarningMessage("Incompatible programming language found, please report at: https://github.com/07joshua03/weblab-vscode/issues \n Falling back to .txt");
            return "solution.txt";
        }
    }

    getTestFileName() {
        if(!this.language) {
            vscode.window.showWarningMessage("Incompatible programming language found, please report at: https://github.com/07joshua03/weblab-vscode/issues \n Falling back to .txt");
            return "test.txt";
        } else if(this.language.toLowerCase().startsWith("java")) {
            return "TestSuite.java";
        } else if(this.language.toLowerCase().startsWith("python")) {
            return "test.py";
        } else {
            vscode.window.showWarningMessage("Incompatible programming language found, please report at: https://github.com/07joshua03/weblab-vscode/issues \n Falling back to .txt");
            return "test.txt";
        }
    }
}

class AssignmentFolder extends TreeItem {
    private locatorId: string;
    private folderLocation: string;
    private parent: AssignmentFolder | null;
    constructor(
        public readonly label: string,
        locatorId: string,
        link: string,
        parent: AssignmentFolder | null = null,
        folderLocation: string = ""
    ) {
        super(label, link, vscode
            .TreeItemCollapsibleState.Collapsed);
        this.locatorId = locatorId;
        this.tooltip = link;
        this.description = this.label;
        this.parent = parent;
        this.folderLocation = folderLocation;
    }

    async openCollapsible(page: Page) {
        if (this.parent) {
            await this.parent.openCollapsible(page);
        }
        await page
            .locator(
                `div[id="${this.locatorId}"] > div > div > a[submitid^="treenode"]`
            )
            .first()
            .click();
        await page.waitForTimeout(200);
    }

    async getChildren(browserManager: BrowserProvider): Promise<TreeItem[]> {
        const username: string = await browserManager.getUsername();

        const page = await browserManager.getBrowserContext().newPage();
        await page.goto(`https://weblab.tudelft.nl/profile/${username}`, {
            waitUntil: "networkidle",
        });
        const assignments: TreeItem[] = [];
        await this.openCollapsible(page);
        const assignmentLocators: Locator[] = await page
            .locator(`div[id="${this.locatorId}"] > div[id^="ph_"] > div[id^="ph_"]`)
            .all();
        for (const assignmentLocator of assignmentLocators) {
            const id =
                (await assignmentLocator.getAttribute("id")) ?? "";
            const name: string = await page
                .locator(
                    `div[id="${id}"]> div.row.assignment-row > div > a.navigate`
                )
                .innerText();

            const link: string = await page
                .locator(
                    `div[id="${id}"]> div.row.assignment-row > div > a.navigate`
                )
                .getAttribute("href") ?? "";
            // Check whether it is a assignment folder or an individual assignment
            if (!(await page
                .locator(
                    `div[id="${id}"]> div.row.assignment-row > div > a[submitid^="treenode"]`
                ).first().getAttribute("class") === "reload-me")) {
                const assignmentResult = new AssignmentFolder(
                    name.trim(),
                    id,
                    link,
                    this,
                    this.folderLocation + "/" + this.label
                );
                assignments.push(assignmentResult);
            } else {
                const assignmentType: string = await page
                    .locator(
                        `div[id="${id}"]> div.row.assignment-row > div > a.navigate > span`
                    ).getAttribute("data-original-title") ?? "";
                if(assignmentType.startsWith("Programming question")) {
                    const regex = /Programming question \((.+)\)/g;
                    const programmingLanguageRegex = regex.exec(assignmentType);
                    if(!programmingLanguageRegex){
                        vscode.window.showErrorMessage("Skipping assignment: "+ name + "\nProgramming question found, but no language detected: " + assignmentType);
                        continue;
                    }
                    const programmingLanguage = programmingLanguageRegex[1];
                    console.log(programmingLanguage);
                    const assignmentResult = new Assignment(
                        name.trim(),
                        link,
                        assignmentType,
                        this.folderLocation + "/" + name.trim(),
                        programmingLanguage
                    );
                    assignments.push(assignmentResult);

                }
                const assignmentResult = new Assignment(
                    name.trim(),
                    link,
                    assignmentType,
                    this.folderLocation + "/" + name.trim()
                );
                assignments.push(assignmentResult);
            }
        }
        await page.close();
        return assignments;
    }
}

class Course extends TreeItem {
    constructor(
        public readonly label: string,
        locator: string,
        tooltip: string = ""
    ) {
        super(label, locator, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = tooltip;
        this.description = this.label;
    }

    async getChildren(browserManager: BrowserProvider): Promise<TreeItem[]> {
        const username: string = await browserManager.getUsername();

        const page = await browserManager.getBrowserContext().newPage();
        await page.goto(`https://weblab.tudelft.nl/profile/${username}`, {
            waitUntil: "networkidle",
        });
        const assignments: TreeItem[] = [];
        const assignmentLocators: Locator[] = await page
            .locator(
                `#Dossier-Overview > #newajaxcontext:has-text("${this.label}") > div > div[id^="ph_"]`
            )
            .all();
        for (const assignmentLocator of assignmentLocators) {
            const assignmentFolderId =
                (await assignmentLocator.getAttribute("id")) ?? "";

            const assignmentFolderLink: string = await page
                .locator(
                    `div[id="${assignmentFolderId}"]> div.row.assignment-row > div > a.navigate`
                ).getAttribute("href") ?? "";

            const assignmentFolderName: string = await page
                .locator(
                    `div[id="${assignmentFolderId}"]> div.row.assignment-row > div > a.navigate`
                )
                .innerText();

            const assignmentResult = new AssignmentFolder(
                assignmentFolderName.trim(),
                assignmentFolderId,
                assignmentFolderLink,
                null,
                this.label.replace(":", "")
            );
            assignments.push(assignmentResult);
        }
        await page.close();
        return assignments;
    }
}
