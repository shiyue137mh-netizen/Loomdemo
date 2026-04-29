import * as StPasses from '@loom/st';

export async function activate(host: any) {
  // We register the Compile and Emit passes that don't need runtime arguments.
  // For Source passes (LoadChat, LoadCharacterCard, LoadLorebook, InitializeStScope),
  // they require arguments and thus cannot be statically registered in a useful way 
  // without dummy parameters. This is part of the architectural friction observed in S2.
  host.registerPass(StPasses.OrderByPosition());
  host.registerPass(StPasses.ActivateWorldInfo());
  host.registerPass(StPasses.FilterInactive());
  host.registerPass(StPasses.CollapseChatToUser());
  host.registerPass(StPasses.InjectStyleToSystem());
  host.registerPass(StPasses.ResolveTemplates());
  host.registerPass(StPasses.AggregateContextByAuthor());
  host.registerPass(StPasses.CleanThinkingPass());
  host.registerPass(StPasses.PruneStatusPass({} as any));
  host.registerPass(StPasses.FlattenToMessages());

  // Register factory functions for source passes
  host.registerPass({ name: 'ST.LoadChat', factory: (params) => StPasses.LoadChat(params.chat) });
  host.registerPass({ name: 'ST.LoadCharacterCard', factory: (params) => StPasses.LoadCharacterCard(params.char) });
  host.registerPass({ name: 'ST.LoadLorebook', factory: (params) => StPasses.LoadLorebook(params.worldbook) });
  host.registerPass({ name: 'ST.InitializeStScope', factory: (params) => StPasses.InitializeStScope(params.options) });

  // A crash pass for observing trace behavior on failure
  host.registerPass({
    name: 'ST.CrashPass',
    run: () => {
      throw new Error('Intentional crash for trace observation');
    }
  });

  host.registerRpc('loom-st.compose', async (params: any) => {
    // Return a typical compile + emit pipeline
    let passes = [
      'ST.OrderByPosition',
      'ST.ActivateWorldInfo',
      'ST.FilterInactive',
      'ST.CollapseChatToUser',
      'ST.InjectStyleToSystem',
      'ST.ResolveTemplates',
      'ST.AggregateContextByAuthor',
      'ST.CleanThinking',
      'ST.PruneStatus',
      'ST.FlattenToMessages'
    ];

    if (params.shouldCrash) {
      passes.splice(2, 0, 'ST.CrashPass'); // insert crash pass early in the pipeline
    }

    return passes;
  });
}
