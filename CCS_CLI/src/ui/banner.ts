import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';

export const showBanner = () => {
    // Pink to Purple gradient
    const ccsGradient = gradient(['#FF69B4', '#DA70D6', '#8A2BE2']);

    console.log(
        ccsGradient(
            figlet.textSync('CCS CLI', {
                font: 'Slant', // Switch to Slant for better readability with gradient
                horizontalLayout: 'default',
                verticalLayout: 'default',
                width: 120,
                whitespaceBreak: true,
            })
        )
    );
    console.log(chalk.dim('  CharacterCard Studio Command Line Interface v1.0.0'));
    console.log(chalk.dim('  --------------------------------------------------\n'));
};
