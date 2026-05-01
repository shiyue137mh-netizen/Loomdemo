import { UpperCasePass } from './passes/upper.js';

export async function activate(host: any) {
  host.registerPass(UpperCasePass);
}
