import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import type { DocumentStore } from './document-store.js';
import type { LoomRunner } from './loom-runner.js';
import type { PluginLoader } from './plugin-loader.js';

export class Transport {
  private wss: WebSocketServer;

  constructor(
    private port: number,
    private docStore: DocumentStore,
    private loomRunner: LoomRunner,
    private pluginLoader: PluginLoader
  ) {
    this.wss = new WebSocketServer({ port });
    this.init();
  }

  private init() {
    this.wss.on('connection', (ws) => {
      const clientId = `client:${nanoid()}`;
      console.log(`Client connected: ${clientId}`);

      ws.on('message', async (data) => {
        try {
          const request = JSON.parse(data.toString());
          const response = await this.handleRequest(request, clientId);
          ws.send(JSON.stringify(response));
        } catch (err) {
          console.error('Error handling message:', err);
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' }
          }));
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
      });
    });

    console.log(`Transport listening on ws://localhost:${this.port}`);
  }

  private async handleRequest(req: any, clientId: string): Promise<any> {
    const { jsonrpc, id, method, params } = req;
    
    if (jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
    }

    try {
      let result: any;
      switch (method) {
        case 'docs.get':
          result = this.docStore.get(params.id);
          break;
        case 'docs.put':
          result = this.docStore.put(params);
          break;
        case 'docs.list':
          result = this.docStore.list(params.type);
          break;
        case 'loom.run':
          result = await this.loomRunner.run({
            ...params,
            invoker: {
              ...params.invoker,
              clientId
            }
          });
          break;
        case 'system.introspect':
          result = {
            studio: { version: '0.1.0' },
            extensions: this.pluginLoader.getExtensions()
          };
          break;
        default:
          // Try extension RPCs
          const rpc = this.pluginLoader.getRpc(method);
          if (rpc) {
            result = await rpc({
              ...params,
              invoker: { ...params?.invoker, clientId }
            });
          } else {
            return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
          }
      }

      return { jsonrpc: '2.0', id, result };
    } catch (err: any) {
      return { jsonrpc: '2.0', id, error: { code: -32603, message: err.message } };
    }
  }

  close() {
    this.wss.close();
  }
}
