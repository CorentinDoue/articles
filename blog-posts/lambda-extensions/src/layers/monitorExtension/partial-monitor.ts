import { EventTypes, ExtensionAPIService } from 'lambda-extension-service';

console.log('Executing monitor extension code...');

const main = async () => {
  const extensionApiService = new ExtensionAPIService({
    extensionName: 'monitor',
  });
  await extensionApiService.register([EventTypes.Invoke, EventTypes.Shutdown]);

  while (true) {
    const event = await extensionApiService.next();
    console.log('Received event', event);
  }
};

main().catch(error => console.error(error));
