import { Browser, BrowserContext, chromium } from "playwright";
import * as vscode from "vscode";

export class BrowserProvider {
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

    registerCommands(context: vscode.ExtensionContext) {
        const login = vscode.commands.registerCommand(
            "weblab-vscode.login",
            async () => {
                await this.login();
            }
        );
        context.subscriptions.push(login);

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
                const page = await this.browserContext.newPage();
                await page.goto(`https://weblab.tudelft.nl/profile/${username}`);
            }
        );
        context.subscriptions.push(openBrowser);
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
            this.context.globalState.get("username");
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
