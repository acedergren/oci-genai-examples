import { checkContainerHealth } from './deployment-helpers';

console.log('Testing SSH connection via bastion...');

const result = await checkContainerHealth('langflow');
console.log('Container health:', result);
