import { Browser, BrowserContext, chromium } from "playwright";
import * as vscode from "vscode";

export class BrowserManager {
    private context: vscode.ExtensionContext;
    private browserContext: BrowserContext;
    private loggedIn: boolean = false;

    constructor(
        context: vscode.ExtensionContext,
        browserContext: BrowserContext
    ) {
        this.context = context;
        this.browserContext = browserContext;
    }

    async login(): Promise<string> {
        let username: string | undefined =
            this.context.workspaceState.get("username");
        while (!username) {
            username = await vscode.window.showInputBox({
                placeHolder: "Enter your username",
            });
            this.context.workspaceState.update("username", username);
        }
        let password: string | undefined;
        while (!password) {
            password = await vscode.window.showInputBox({
                placeHolder: "Enter your password",
                password: true,
            });
        }
        const page = await this.browserContext.newPage();
        await page.goto("https://weblab.tudelft.nl/samlsignin");
        await page.fill('input[name="username"]', username);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');
        await page.waitForURL("https://weblab.tudelft.nl");
        this.loggedIn = true;
        await page.close();
        return username;
    }

    async isLoggedIn(): Promise<boolean> {
        // let username: string | undefined =
        //     this.context.workspaceState.get("username");
        // if (!username) {
        //     return false;
        // }
        // const page = await this.browserContext.newPage();
        // await page.goto("https://weblab.tudelft.nl/profile/" + username, {
        //     waitUntil: "networkidle",
        // });
        // const loggedIn =
        //     page.url() === "https://weblab.tudelft.nl/profile/" + username;
        // await page.close();
        return this.loggedIn;
    }

    /**
     * Gets the username of the user (Asks user to login if necessary)
     * @returns the username of the user
     */
    async getUsername(): Promise<string> {
        let username: string | undefined =
            this.context.workspaceState.get("username");
        if (!username || !(await this.isLoggedIn())) {
            username = await this.login();
        }
        return username;
    }

    getBrowserContext(): BrowserContext {
        return this.browserContext;
    }

    getContext(): vscode.ExtensionContext {
        return this.context;
    }
}
