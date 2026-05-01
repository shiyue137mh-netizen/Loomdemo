import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import stringWidth from 'string-width';
import { PipelineResult } from '@loom/core';

/**
 * Loom DevTool: 终端流水线仪表盘
 */
export function renderPipelineDashboard(result: PipelineResult<any>) {
  const { snapshots } = result;
  const lastSnapshot = snapshots[snapshots.length - 1];
  
  console.log('\n' + chalk.bold.cyan(' 🧶 LOOM PIPELINE DEBUG CONSOLE ') + '\n');

  // 1. 顶部状态栏
  const totalDuration = snapshots.reduce((sum, s) => sum + s.durationMs, 0).toFixed(2);
  const header = boxen(
    `${chalk.white('Total Passes:')} ${chalk.green(snapshots.length)}\n` +
    `${chalk.white('Total Time:')}   ${chalk.yellow(totalDuration + 'ms')}\n` +
    `${chalk.white('Result Status:')} ${chalk.green('SUCCESS')}`,
    { padding: 1, margin: { bottom: 1 }, borderColor: 'cyan', title: 'Pipeline Stats' }
  );
  console.log(header);

  // 2. 流水线步骤表格
  const passTable = new Table({
    head: [chalk.cyan('Step'), chalk.cyan('Pass Name'), chalk.cyan('Frags'), chalk.cyan('Time'), chalk.cyan('Logs')],
    colWidths: [6, 25, 8, 12, 40],
    wordWrap: true
  });

  snapshots.forEach((s, i) => {
    let logSummary = '';
    if (s.logs.length > 0) {
      logSummary = s.logs.map(l => {
        let msg = `• ${l.message}`;
        if (l.data?.keyword) {
          msg += ` ${chalk.yellow(`(词: ${l.data.keyword})`)}`;
        }
        if (l.data?.context) {
          msg += `\n  ${chalk.dim('↳ Context:')} ${chalk.italic(l.data.context)}`;
        }
        return msg;
      }).join('\n');
    } else {
      logSummary = chalk.dim('No logs');
    }
    
    passTable.push([
      i + 1,
      chalk.bold(s.passName),
      s.fragments.length,
      s.durationMs.toFixed(2) + 'ms',
      logSummary
    ]);
  });

  console.log(chalk.bold(' [1/2] Execution Flow:'));
  console.log(passTable.toString());

  // 3. 最终状态监控 (Scope Monitor)
  const scopeTable = new Table({
    head: [chalk.cyan('Variable Path'), chalk.cyan('Value')],
    colWidths: [35, 45]
  });

  const scopeEntries = lastSnapshot.scopeEntries;
  Object.entries(scopeEntries).forEach(([key, value]) => {
    let displayValue = String(value);
    if (typeof value === 'object') displayValue = JSON.stringify(value).substring(0, 40) + '...';
    if (displayValue.length > 40) displayValue = displayValue.substring(0, 37) + '...';
    
    scopeTable.push([chalk.green(key), displayValue]);
  });

  console.log('\n' + chalk.bold(' [2/3] Final Scope State:'));
  console.log(scopeTable.toString());

  // 4. 世界书激活深度报告 (NEW!)
  const activationLogs = snapshots.flatMap(s => s.logs).filter(l => l.message.startsWith('WI_ACTIVATE'));
  
  if (activationLogs.length > 0) {
    console.log('\n' + chalk.bold(' [3/3] ✨ World Info Activation Report:'));
    const activateTable = new Table({
      head: [chalk.cyan('Lorebook Entry'), chalk.cyan('Trigger Keyword'), chalk.cyan('Source Context')],
      colWidths: [25, 20, 45],
      wordWrap: true
    });

    activationLogs.forEach(l => {
      const entryName = l.message.match(/\[(.*?)\]/)?.[1] || 'Unknown';
      activateTable.push([
        chalk.bold.blue(entryName),
        chalk.bold.yellow(l.data?.keyword || 'N/A'),
        chalk.italic.gray(l.data?.context || 'N/A')
      ]);
    });
    console.log(activateTable.toString());
  }

  // 5. Raw vs Final 溯源报告 (NEW!)
  const firstSnapshot = snapshots[0];
  console.log('\n' + chalk.bold(' [4/4] 🔍 Source Tracking (Raw vs Final):'));
  const trackingTable = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Raw (Initial)'), chalk.cyan('Final (Result)')],
    colWidths: [25, 30, 35]
  });

  trackingTable.push(
    ['Fragment Count', firstSnapshot.fragments.length, result.fragments.length],
    ['Active WIs', firstSnapshot.fragments.filter(f => f.meta.active).length, result.fragments.filter(f => f.meta.active).length],
    ['Scope Keys', Object.keys(firstSnapshot.scopeEntries).length, Object.keys(lastSnapshot.scopeEntries).length]
  );
  console.log(trackingTable.toString());

  // 6. 产物预览
  const messagesFragment = result.fragments.find(f => f.id === 'openai-messages');
  if (messagesFragment) {
    const messages = JSON.parse(messagesFragment.content);
    const lastMsg = messages[messages.length - 1];
    
    const preview = boxen(
      `${chalk.magenta('System Instructions (Top):')}\n${chalk.dim(messages[0].content.substring(0, 200) + '...')}\n\n` +
      `${chalk.blue('Last Chat Message:')}\n${chalk.white(lastMsg.content)}`,
      { padding: 1, borderColor: 'magenta', title: 'Prompt Result Preview' }
    );
    console.log('\n' + preview);
  }
  
  console.log('\n' + chalk.dim('--- End of Debug Session ---') + '\n');
}

export * from './snapshot-store.js';
