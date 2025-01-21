import * as vscode from "vscode";
import { BrowserManager } from "./browserManager";
import { Locator, Page } from "playwright";
import { open } from "fs";
export class CourseProvider implements vscode.TreeDataProvider<TreeItem> {
    private browserManager: BrowserManager;

    constructor(browserManager: BrowserManager) {
        this.browserManager = browserManager;
    }

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: TreeItem | undefined): Thenable<TreeItem[]> {
        if (element) {
            return element.getChildren(this.browserManager);
        } else {
            return this.getCourses();
        }
    }

    async getCourses(): Promise<Course[]> {
        const username: string = await this.browserManager.getUsername();

        const page = await this.browserManager.getBrowserContext().newPage();
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
                courseRootName,
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
    private link: string;
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

    abstract getChildren(browserManager: BrowserManager): Promise<TreeItem[]>;
}

class Assignment extends TreeItem {
    type: string;
    constructor(
        public readonly label: string,
        link: string,
        type: string
    ) {
        super(label, link, vscode.TreeItemCollapsibleState.None, type);
        this.description = type;
        this.type = type;
        this.tooltip = link;
    }
    getChildren(_browserManager: BrowserManager): Promise<TreeItem[]> {
        return Promise.resolve([]);
    }
}

class AssignmentFolder extends TreeItem {
    private locatorId: string;
    private parent: AssignmentFolder | null;
    constructor(
        public readonly label: string,
        locatorId: string,
        link: string,
        parent: AssignmentFolder | null = null
    ) {
        super(label, link, vscode
            .TreeItemCollapsibleState.Collapsed);
        this.locatorId = locatorId;
        this.tooltip = link;
        this.description = this.label;
        this.parent = parent;
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

    async getChildren(browserManager: BrowserManager): Promise<TreeItem[]> {
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
            if (!( await page
                .locator(
                    `div[id="${id}"]> div.row.assignment-row > div > a[submitid^="treenode"]`
                ).first().getAttribute("class") === "reload-me")) {
                const assignmentResult = new AssignmentFolder(
                    name,
                    id,
                    link,
                    this
                );
                assignments.push(assignmentResult);
            } else {
                const assignmentType: string = await page
                    .locator(
                        `div[id="${id}"]> div.row.assignment-row > div > a.navigate > span`
                    ).getAttribute("data-original-title") ?? "";
                const assignmentResult = new Assignment(
                    name,
                    link,
                    assignmentType
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

    async getChildren(browserManager: BrowserManager): Promise<TreeItem[]> {
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
                assignmentFolderName,
                assignmentFolderId,
                assignmentFolderLink
            );
            assignments.push(assignmentResult);
        }
        await page.close();
        return assignments;
    }
}
