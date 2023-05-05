export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const layer = new LayerVersion(scope, 'MonitorLayer', {
      code: Code.fromAsset('dist/layers/monitorExtension'),
    });

    const helloFunction = new NodejsFunction(this, 'Hello', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, `/../src/functions/hello/handler.ts`),
      layers: [layer],
    });
  }
}
