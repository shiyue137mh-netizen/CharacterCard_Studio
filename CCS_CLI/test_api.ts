import chalk from 'chalk';
import { ChatApi } from './src/api/api-wrappers';

async function test() {
    try {
        console.log(chalk.blue('Testing SillyTavern API connectivity...'));
        const chat = await ChatApi.getCurrentChat();
        if (chat) {
            console.log(chalk.green('✅ Successfully fetched current chat!'));
            console.log(chalk.cyan(`Character: ${chat.character}`));
            console.log(chalk.dim(`Messages: ${chat.messages.length}`));
        } else {
            console.log(chalk.yellow('⚠️ Connected but no active chat found.'));
        }
    } catch (e: any) {
        console.error(chalk.red('❌ API Test Failed:'), e.message);
    }
}

test();
