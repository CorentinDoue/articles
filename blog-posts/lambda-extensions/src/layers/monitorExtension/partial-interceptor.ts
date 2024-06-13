import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.all('*', async req => {
    const url = req.url.toString();
    const method = req.method;
    console.log(`request intercepted in interceptor: ${method} ${url}`);

    return req.passthrough();
  }),
);

server.listen({ onUnhandledRequest: 'bypass' });
