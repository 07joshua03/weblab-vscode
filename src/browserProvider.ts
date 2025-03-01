import { Browser, BrowserContext, chromium } from "playwright";
import * as vscode from "vscode";

export class BrowserProvider {
    private context: vscode.ExtensionContext;
    private browserContext: BrowserContext | undefined;
    private loggedIn: boolean = false;

    constructor(
        context: vscode.ExtensionContext,
    ) {
        this.context = context;
    }

    async initializeBrowser() {
        if (!this.browserContext) {
            let browser: Browser;
            try {
                browser = await chromium.launch({ headless: true });
            } catch (e) {
                await this.installHelper(e);
                return;
            }
            const browserContext = await browser.newContext();
            this.browserContext = browserContext;
        }
    }

    async installHelper(e: any) {
        vscode.window.showErrorMessage("Playwright is probably not installed.\n" + e);
        const result: string = (await vscode.window.showQuickPick([
            "Yes, please install Playwright browsers for WebLab (requires NPM)",
            "No (This will deactivate WebLab plugin)"],
            {
                title: "Playwright browsers are probably not installed. Would you like to install?"
            }) ?? "No");
        if (result.startsWith("Yes")) {
            const terminal = vscode.window.createTerminal("Playwright Install Terminal");
            terminal.show(false);
            terminal.sendText("npx playwright@1.38 install", true);
            vscode.window.showInformationMessage("Please restart VS Code after installing Playwright browser");
        } else {
            vscode.window.showErrorMessage("Deactivating WebLab for VS Code");
        }
    }

    registerCommands(context: vscode.ExtensionContext) {
        const login = vscode.commands.registerCommand(
            "weblab-vscode.login",
            async () => {
                await this.login();
            }
        );
        context.subscriptions.push(login);

        const reauthenticate = vscode.commands.registerCommand(
            "weblab-vscode.reauthenticate",
            async () => {
                await this.reauth();
            }
        );
        context.subscriptions.push(reauthenticate);

        const isLoggedIn = vscode.commands.registerCommand(
            "weblab-vscode.isLoggedIn",
            async () => {
                vscode.window.showInformationMessage(
                    (await this.isLoggedIn()) ? "Logged in" : "Not logged in"
                );
            }
        );
        context.subscriptions.push(isLoggedIn);

        const openBrowser = vscode.commands.registerCommand(
            "weblab-vscode.openBrowser",
            async () => {
                const username = await this.getUsername();
                const page = await this.getBrowserContext().newPage();
                await page.goto(`https://weblab.tudelft.nl/profile/${username}`);
            }
        );
        context.subscriptions.push(openBrowser);
    }

    async reauth() {
        let username: string | undefined =
            undefined;
        while (!username) {
            username = await vscode.window.showInputBox({
                placeHolder: "Enter your username",
            });
            this.context.globalState.update("username", username);
        }
        let password: string | undefined = undefined;
        while (!password) {
            password = await vscode.window.showInputBox({
                placeHolder: "Enter your password",
                password: true,
            });
            this.context.secrets.store("password", password ?? "");
        }
        const page = await this.getBrowserContext().newPage();
        await page.goto("https://weblab.tudelft.nl/samlsignin");
        await page.fill('input[name="username"]', username);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');
        await page.waitForURL("https://weblab.tudelft.nl");
        this.loggedIn = true;
        await page.close();
        return username;
    }

    async login(): Promise<string> {
        let username: string | undefined =
            this.context.globalState.get("username");
        while (!username) {
            username = await vscode.window.showInputBox({
                placeHolder: "Enter your username",
            });
            this.context.globalState.update("username", username);
        }
        let password: string | undefined = await this.context.secrets.get("password");
        while (!password) {
            password = await vscode.window.showInputBox({
                placeHolder: "Enter your password",
                password: true,
            });
            this.context.secrets.store("password", password ?? "");
        }
        const page = await this.getBrowserContext().newPage();
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
            this.context.globalState.get("username");
        if (!username || !(await this.isLoggedIn())) {
            username = await this.login();
        }
        return username;
    }

    getBrowserContext(): BrowserContext {
        if (!this.browserContext) {
            vscode.window.showErrorMessage("No browser initialized! Is WebLab enabled?");
            throw new Error("No browser context initialized!");
        }
        return this.browserContext;
    }

    getContext(): vscode.ExtensionContext {
        return this.context;
    }
}
