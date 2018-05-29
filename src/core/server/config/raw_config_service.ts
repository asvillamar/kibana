import { isEqual, isPlainObject } from 'lodash';
import typeDetect from 'type-detect';
import {
  BehaviorSubject,
  filter,
  k$,
  map,
  Observable,
  skipRepeats,
} from '../../lib/kbn_observable';

import { ObjectToRawConfigAdapter } from './object_to_raw_config_adapter';
import { RawConfig } from './raw_config';
import { getConfigFromFile } from './read_config';

// Used to indicate that no config has been received yet
const notRead = Symbol('config not yet read');

export class RawConfigService {
  /**
   * The stream of configs read from the config file. Will be the symbol
   * `notRead` before the config is initially read, and after that it can
   * potentially be `null` for an empty yaml file.
   *
   * This is the _raw_ config before any overrides are applied.
   *
   * As we have a notion of a _current_ config we rely on a BehaviorSubject so
   * every new subscription will immediately receive the current config.
   */
  private readonly rawConfigFromFile$: BehaviorSubject<
    any
  > = new BehaviorSubject(notRead);

  private readonly config$: Observable<RawConfig>;

  constructor(readonly configFile: string) {
    this.config$ = k$(this.rawConfigFromFile$)(
      filter(rawConfig => rawConfig !== notRead),
      map(rawConfig => {
        // If the raw config is null, e.g. if empty config file, we default to
        // an empty config
        if (rawConfig == null) {
          return new ObjectToRawConfigAdapter({});
        }

        if (isPlainObject(rawConfig)) {
          // TODO Make config consistent, e.g. handle dots in keys
          return new ObjectToRawConfigAdapter(rawConfig);
        }

        throw new Error(
          `the raw config must be an object, got [${typeDetect(rawConfig)}]`
        );
      }),
      // We only want to update the config if there are changes to it
      skipRepeats(isEqual)
    );
  }

  /**
   * Read the initial Kibana config.
   */
  public loadConfig() {
    const config = getConfigFromFile(this.configFile);
    this.rawConfigFromFile$.next(config);
  }

  public stop() {
    this.rawConfigFromFile$.complete();
  }

  /**
   * Re-read the Kibana config.
   */
  public reloadConfig() {
    this.loadConfig();
  }

  public getConfig$() {
    return this.config$;
  }
}