import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { CLICommand, CommandArgs, ProgressIndicator, Logger } from '../types';

export class CLIInterface {
  private program: Command;
  private logger: Logger;
  private commands: Map<string, CLICommand> = new Map();

  constructor(logger: Logger) {
    this.program = new Command();
    this.logger = logger;
    this.setupProgram();
  }

  private setupProgram(): void {
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

  private handlePreAction(command: Command): void {
    const options = command.opts();
    
    if (options.verbose) {
      this.logger.info('Verbose mode enabled');
    }

    this.logger.debug(`Executing command: ${command.name()}`, {
      args: command.args,
      options
    });
  }

  public registerCommand(command: CLICommand): void {
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
      } catch (error) {
        this.handleError(error as Error, command.name);
      }
    });

    this.commands.set(command.name, command);
  }

  private registerSubcommand(parentCommand: Command, subcommand: CLICommand): void {
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
      } catch (error) {
        this.handleError(error as Error, `${parentCommand.name()} ${subcommand.name}`);
      }
    });
  }

  private parseCommandArgs(args: any, options: any[]): CommandArgs {
    const parsed: CommandArgs = {};
    
    options.forEach(option => {
      const value = args[option.name];
      if (value !== undefined) {
        parsed[option.name] = value;
      }
    });

    return parsed;
  }

  private handleError(error: Error, commandName: string): void {
    this.logger.error(`Command '${commandName}' failed`, error);
    
    console.error(chalk.red('✗'), chalk.bold(`Error in command '${commandName}':`));
    console.error(chalk.red(error.message));
    
    if (process.env.NODE_ENV === 'development') {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }

  public async execute(argv: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      this.handleError(error as Error, 'cli');
    }
  }

  // Utility methods for CLI interactions
  public createProgressIndicator(): ProgressIndicator {
    let spinner: any = null;

    return {
      start: (message: string) => {
        spinner = ora(message).start();
      },
      update: (message: string, progress?: number) => {
        if (spinner) {
          if (progress !== undefined) {
            spinner.text = `${message} (${progress}%)`;
          } else {
            spinner.text = message;
          }
        }
      },
      success: (message: string) => {
        if (spinner) {
          spinner.succeed(message);
          spinner = null;
        } else {
          console.log(chalk.green('✓'), message);
        }
      },
      error: (message: string) => {
        if (spinner) {
          spinner.fail(message);
          spinner = null;
        } else {
          console.log(chalk.red('✗'), message);
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

  public async prompt<T extends Record<string, any>>(questions: inquirer.QuestionCollection<T>): Promise<T> {
    return await inquirer.prompt<T>(questions);
  }

  public confirm(message: string): Promise<boolean> {
    return this.prompt({
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false
    }).then(answers => answers.confirmed);
  }

  public select(message: string, choices: string[]): Promise<string> {
    return this.prompt({
      type: 'list',
      name: 'selected',
      message,
      choices
    }).then(answers => answers.selected);
  }

  public input(message: string, defaultValue?: string): Promise<string> {
    return this.prompt({
      type: 'input',
      name: 'value',
      message,
      default: defaultValue
    }).then(answers => answers.value);
  }

  public password(message: string): Promise<string> {
    return this.prompt({
      type: 'password',
      name: 'value',
      message
    }).then(answers => answers.value);
  }

  public checkbox(message: string, choices: string[]): Promise<string[]> {
    return this.prompt({
      type: 'checkbox',
      name: 'selected',
      message,
      choices
    }).then(answers => answers.selected);
  }

  // Display utilities
  public success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  public error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  public warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  public info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  public highlight(message: string): void {
    console.log(chalk.cyan('→'), message);
  }

  public title(message: string): void {
    console.log(chalk.bold.underline(message));
  }

  public subtitle(message: string): void {
    console.log(chalk.bold(message));
  }

  public table(data: Record<string, any>[]): void {
    if (data.length === 0) {
      this.info('No data to display');
      return;
    }

    const headers = Object.keys(data[0]);
    const columnWidths = headers.map(header => 
      Math.max(header.length, ...data.map(row => String(row[header]).length))
    );

    // Print header
    const headerRow = headers.map((header, i) => 
      header.padEnd(columnWidths[i])
    ).join(' | ');
    console.log(chalk.bold(headerRow));
    console.log(columnWidths.map(width => '-'.repeat(width)).join('-|-'));

    // Print data rows
    data.forEach(row => {
      const dataRow = headers.map((header, i) => 
        String(row[header]).padEnd(columnWidths[i])
      ).join(' | ');
      console.log(dataRow);
    });
  }

  public json(data: any, pretty: boolean = true): void {
    console.log(JSON.stringify(data, null, pretty ? 2 : 0));
  }

  public list(items: string[], bullet: string = '•'): void {
    items.forEach(item => {
      console.log(`${bullet} ${item}`);
    });
  }

  public divider(char: string = '-', length: number = 50): void {
    console.log(char.repeat(length));
  }

  public newline(count: number = 1): void {
    console.log('\n'.repeat(count - 1));
  }
}
