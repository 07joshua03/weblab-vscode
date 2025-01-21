import * as vscode from 'vscode';
import { BrowserManager } from './browserManager';
export class CourseProvider implements vscode.TreeDataProvider<string> {

    private browserManager: BrowserManager;

    constructor(browserManager: BrowserManager) {
        this.browserManager = browserManager;
    }
    
    getTreeItem(element: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new vscode.TreeItem(element);
    }
    getChildren(element?: string | undefined): Thenable<string[]> {
        if (element){
            return Promise.resolve([]);
        } else {
            return this.getCourses();
        }
    }

     async getCourses(): Promise<string[]> {
        const username: string = await this.browserManager.getUsername();
        
        const page = await this.browserManager.getBrowserContext().newPage();
        await page.goto(`https://weblab.tudelft.nl/profile/${username}`);
    
        await page.waitForTimeout(2000);
    
        const courses = await page.locator("#Dossier-Overview > #newajaxcontext > div > div > div > a > strong").allInnerTexts();

        await page.close();
        return courses;
    };

    
}