"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIInterface = void 0;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const ora_1 = __importDefault(require("ora"));
class CLIInterface {
    constructor(logger) {
        this.commands = new Map();
        this.program = new commander_1.Command();
        this.logger = logger;
        this.setupProgram();
    }
    setupProgram() {
        this.program
            .name('ai-builder')
            .description('AI Builder - Automated deployment platform with built-in database and chat')
            .version('1.0.0');
        // Global options
        this.program
            .option('-v, --verbose', 'Enable verbose logging')
            .option('--config <path>', 'Path to config file')
            .option('--no-color', 'Disable colored output')
            .hook('preAction', (thisCommand) => {
            this.handlePreAction(thisCommand);
        });
    }
    handlePreAction(command) {
        const options = command.opts();
        if (options.verbose) {
            this.logger.info('Verbose mode enabled');
        }
        this.logger.debug(`Executing command: ${command.name()}`, {
            args: command.args,
            options
        });
    }
    registerCommand(command) {
        const cmd = this.program
            .command(command.name)
            .description(command.description);
        // Add options
        command.options.forEach(option => {
            const optionString = option.alias ? `-${option.alias}, --${option.name}` : `--${option.name}`;
            cmd.option(optionString, option.description, option.default);
        });
        // Add subcommands if any
        if (command.subcommands) {
            command.subcommands.forEach(subcommand => {
                this.registerSubcommand(cmd, subcommand);
            });
        }
        // Set the handler
        cmd.action(async (args, ...rest) => {
            try {
                const commandArgs = this.parseCommandArgs(args, command.options);
                await command.handler(commandArgs);
            }
            catch (error) {
                this.handleError(error, command.name);
            }
        });
        this.commands.set(command.name, command);
    }
    registerSubcommand(parentCommand, subcommand) {
        const cmd = parentCommand
            .command(subcommand.name)
            .description(subcommand.description);
        // Add options
        subcommand.options.forEach(option => {
            const optionString = option.alias ? `-${option.alias}, --${option.name}` : `--${option.name}`;
            cmd.option(optionString, option.description, option.default);
        });
        // Set the handler
        cmd.action(async (args) => {
            try {
                const commandArgs = this.parseCommandArgs(args, subcommand.options);
                await subcommand.handler(commandArgs);
            }
            catch (error) {
                this.handleError(error, `${parentCommand.name()} ${subcommand.name}`);
            }
        });
    }
    parseCommandArgs(args, options) {
        const parsed = {};
        options.forEach(option => {
            const value = args[option.name];
            if (value !== undefined) {
                parsed[option.name] = value;
            }
        });
        return parsed;
    }
    handleError(error, commandName) {
        this.logger.error(`Command '${commandName}' failed`, error);
        console.error(chalk_1.default.red('✗'), chalk_1.default.bold(`Error in command '${commandName}':`));
        console.error(chalk_1.default.red(error.message));
        if (process.env.NODE_ENV === 'development') {
            console.error(chalk_1.default.gray(error.stack));
        }
        process.exit(1);
    }
    async execute(argv) {
        try {
            await this.program.parseAsync(argv);
        }
        catch (error) {
            this.handleError(error, 'cli');
        }
    }
    // Utility methods for CLI interactions
    createProgressIndicator() {
        let spinner = null;
        return {
            start: (message) => {
                spinner = (0, ora_1.default)(message).start();
            },
            update: (message, progress) => {
                if (spinner) {
                    if (progress !== undefined) {
                        spinner.text = `${message} (${progress}%)`;
                    }
                    else {
                        spinner.text = message;
                    }
                }
            },
            success: (message) => {
                if (spinner) {
                    spinner.succeed(message);
                    spinner = null;
                }
                else {
                    console.log(chalk_1.default.green('✓'), message);
                }
            },
            error: (message) => {
                if (spinner) {
                    spinner.fail(message);
                    spinner = null;
                }
                else {
                    console.log(chalk_1.default.red('✗'), message);
                }
            },
            stop: () => {
                if (spinner) {
                    spinner.stop();
                    spinner = null;
                }
            }
        };
    }
    async prompt(questions) {
        return await inquirer_1.default.prompt(questions);
    }
    confirm(message) {
        return this.prompt({
            type: 'confirm',
            name: 'confirmed',
            message,
            default: false
        }).then(answers => answers.confirmed);
    }
    select(message, choices) {
        return this.prompt({
            type: 'list',
            name: 'selected',
            message,
            choices
        }).then(answers => answers.selected);
    }
    input(message, defaultValue) {
        return this.prompt({
            type: 'input',
            name: 'value',
            message,
            default: defaultValue
        }).then(answers => answers.value);
    }
    password(message) {
        return this.prompt({
            type: 'password',
            name: 'value',
            message
        }).then(answers => answers.value);
    }
    checkbox(message, choices) {
        return this.prompt({
            type: 'checkbox',
            name: 'selected',
            message,
            choices
        }).then(answers => answers.selected);
    }
    // Display utilities
    success(message) {
        console.log(chalk_1.default.green('✓'), message);
    }
    error(message) {
        console.log(chalk_1.default.red('✗'), message);
    }
    warning(message) {
        console.log(chalk_1.default.yellow('⚠'), message);
    }
    info(message) {
        console.log(chalk_1.default.blue('ℹ'), message);
    }
    highlight(message) {
        console.log(chalk_1.default.cyan('→'), message);
    }
    title(message) {
        console.log(chalk_1.default.bold.underline(message));
    }
    subtitle(message) {
        console.log(chalk_1.default.bold(message));
    }
    table(data) {
        if (data.length === 0) {
            this.info('No data to display');
            return;
        }
        const headers = Object.keys(data[0]);
        const columnWidths = headers.map(header => Math.max(header.length, ...data.map(row => String(row[header]).length)));
        // Print header
        const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ');
        console.log(chalk_1.default.bold(headerRow));
        console.log(columnWidths.map(width => '-'.repeat(width)).join('-|-'));
        // Print data rows
        data.forEach(row => {
            const dataRow = headers.map((header, i) => String(row[header]).padEnd(columnWidths[i])).join(' | ');
            console.log(dataRow);
        });
    }
    json(data, pretty = true) {
        console.log(JSON.stringify(data, null, pretty ? 2 : 0));
    }
    list(items, bullet = '•') {
        items.forEach(item => {
            console.log(`${bullet} ${item}`);
        });
    }
    divider(char = '-', length = 50) {
        console.log(char.repeat(length));
    }
    newline(count = 1) {
        console.log('\n'.repeat(count - 1));
    }
}
exports.CLIInterface = CLIInterface;
