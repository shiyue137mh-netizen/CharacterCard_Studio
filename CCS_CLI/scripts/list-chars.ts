import { CharacterReader } from '../src/api/api-wrappers';
import { ConfigLoader } from '../src/services/config';

async function list() {
    ConfigLoader.load(); // Load env
    console.log('API URL:', ConfigLoader.load().apiUrl);

    try {
        const chars = await CharacterReader.getAll();
        console.log('Found characters:', chars.length);
        chars.forEach(c => console.log(`- ${c.name} (avatar: ${c.avatar})`));
    } catch (e) {
        console.error('Error:', e);
    }
}

list();
