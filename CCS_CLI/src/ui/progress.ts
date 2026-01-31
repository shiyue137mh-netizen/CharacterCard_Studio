import chalk from 'chalk';
import cliProgress from 'cli-progress';
import ora, { Ora } from 'ora';

export class UI {
    private static spinner: Ora | null = null;
    private static multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {percentage}% | {value}/{total} | {msg}'
    }, cliProgress.Presets.shades_classic);

    static startSpinner(text: string) {
        if (this.spinner) {
            this.spinner.text = text;
        } else {
            this.spinner = ora(text).start();
        }
    }

    static succeedSpinner(text: string) {
        if (this.spinner) {
            this.spinner.succeed(text);
            this.spinner = null;
        } else {
            console.log(chalk.hex('#DA70D6')(`✔ ${text}`)); // Orchid
        }
    }

    static failSpinner(text: string) {
        if (this.spinner) {
            this.spinner.fail(text);
            this.spinner = null;
        } else {
            console.error(chalk.hex('#FF1493')(`✖ ${text}`)); // DeepPink
        }
    }

    static stopSpinner() {
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = null;
        }
    }

    static createProgressBar(total: number, startValue: number = 0) {
        return this.multibar.create(total, startValue, { msg: 'Processing...' });
    }

    static stopAll() {
        this.stopSpinner();
        this.multibar.stop();
    }
}
