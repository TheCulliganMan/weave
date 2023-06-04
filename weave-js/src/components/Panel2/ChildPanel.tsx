import EditableField from '@wandb/weave/common/components/EditableField';
import {
  linkHoverBlue,
  GRAY_50,
  GRAY_350,
  Colors,
  hexToRGB,
} from '@wandb/weave/common/css/globals.styles';
import {ValidatingTextInput} from '@wandb/weave/components/ValidatingTextInput';
import {
  defaultLanguageBinding,
  filterNodes,
  Frame,
  ID,
  isAssignableTo,
  isNodeOrVoidNode,
  Node,
  NodeOrVoidNode,
  replaceChainRoot,
  Stack,
  varNode,
  voidNode,
  Weave,
} from '@wandb/weave/core';
import {isValidVarName} from '@wandb/weave/core/util/var';
import {Draft} from 'immer';
import * as _ from 'lodash';
import React, {useCallback, useMemo, useState} from 'react';
import {Icon, Popup} from 'semantic-ui-react';
import styled from 'styled-components';

import {useWeaveContext} from '../../context';
import {WeaveExpression} from '../../panel/WeaveExpression';
import {useNodeWithServerType} from '../../react';
import {consoleLog} from '../../util';
import {
  getPanelStacksForType,
  panelSpecById,
  usePanelStacksForType,
} from './availablePanels';
import * as ConfigPanel from './ConfigPanel';
import {PanelInput, PanelProps} from './panel';
import {Panel, PanelConfigEditor} from './PanelComp';
import {
  ExpressionEvent,
  PanelContextProvider,
  usePanelContext,
} from './PanelContext';
import * as Styles from './PanelExpression/styles';
import {
  usePanelInputExprIsHighlightedByPath,
  useSelectedPath,
  useSetInspectingChildPanel,
  useSetPanelInputExprIsHighlighted,
} from './PanelInteractContext';
import {getStackIdAndName} from './panellib/libpanel';
import PanelNameEditor from './PanelNameEditor';
import {TableState} from './PanelTable/tableState';
import {ConfigSection} from './ConfigPanel';
import {IconPencilEdit} from './Icons';
import {IconButton} from '../IconButton';

// This could be rendered as a code block with assignments, like
// so.
// ```
// a = input + 4; // will be in scope of descendent panels
// return PanelWhatever(a / 2, panel_whatever_config)
// ```

const allowPanel = (stackId: string) => {
  return (
    stackId.includes('projection') ||
    stackId.includes('maybe') ||
    !stackId.includes('.')
  );
};

export interface ChildPanelFullConfig {
  vars: Frame;
  input_node: NodeOrVoidNode;
  id: string;
  config: any;
}

export type ChildPanelConfig =
  | undefined
  | ChildPanelFullConfig
  | NodeOrVoidNode;

export const isChildPanelFullConfig = (o: any): o is ChildPanelFullConfig => {
  if (o != null && o.id != null && o.vars != null && o.input_node != null) {
    return true;
  }
  return false;
};

export const getFullChildPanel = (
  item: ChildPanelConfig
): ChildPanelFullConfig => {
  if (item == null) {
    return CHILD_PANEL_DEFAULT_CONFIG;
  } else if (isNodeOrVoidNode(item)) {
    return {...CHILD_PANEL_DEFAULT_CONFIG, input_node: item};
  } else {
    return item;
  }
};

const initPanelConfig = async (
  weave: Weave,
  id: string,
  // inputNode must be refined by caller
  inputNode: NodeOrVoidNode,
  stack: Stack
) => {
  const panelSpec = panelSpecById(id);
  if (panelSpec?.initialize != null) {
    return await panelSpec.initialize(weave, inputNode, stack);
  }
  return undefined;
};

export const initPanel = async (
  weave: Weave,
  inputNode: NodeOrVoidNode,
  panelId: string | undefined,
  allowedPanels: string[] | undefined,
  stack: Stack
): Promise<ChildPanelFullConfig> => {
  inputNode = await weave.refineNode(inputNode, stack);
  const {curPanelId: id} = getPanelStacksForType(inputNode.type, panelId, {
    allowedPanels,
    stackIdFilter: allowPanel,
  });
  if (id == null) {
    return {vars: {}, input_node: voidNode(), id: '', config: undefined};
  }
  return {
    vars: {},
    id,
    input_node: inputNode,
    config: await initPanelConfig(weave, id, inputNode, stack),
  };
};

export const mutateEnsureItemIsFullChildPanel = (
  items: Draft<{[key: string]: ChildPanelConfig}>,
  key: string
): void => {
  const item = items[key];
  if (item == null) {
    items[key] = CHILD_PANEL_DEFAULT_CONFIG;
  } else if (isNodeOrVoidNode(item)) {
    items[key] = {...CHILD_PANEL_DEFAULT_CONFIG, input_node: item};
  }
};

export const childPanelFromTableState = (
  tableState: TableState,
  colId: string
): ChildPanelFullConfig => {
  return {
    vars: {},
    input_node: tableState.columnSelectFunctions[colId],
    id: tableState.columns[colId].panelId,
    config: tableState.columns[colId].panelConfig,
  };
};

export const CHILD_PANEL_DEFAULT_CONFIG: ChildPanelFullConfig = {
  vars: {},
  input_node: voidNode(),
  id: '',
  config: undefined,
};
const useChildPanelConfig = (
  config: ChildPanelConfig
): ChildPanelFullConfig => {
  return useMemo(() => getFullChildPanel(config), [config]);
};

interface ChildPanelProps {
  editable?: boolean;
  passthroughUpdate?: boolean;
  pathEl?: string;
  prefixHeader?: JSX.Element;
  prefixButtons?: JSX.Element;
  allowedPanels?: string[];
  config: ChildPanelConfig | undefined;
  updateConfig: (newConfig: ChildPanelFullConfig) => void;
  updateConfig2?: (change: (oldConfig: any) => any) => void;
  updateInput?: (partialInput: PanelInput) => void;
  updateName?: (newName: string) => void;
}

const useChildPanelCommon = (props: ChildPanelProps) => {
  const {updateConfig, updateConfig2} = props;
  const config = useChildPanelConfig(props.config);
  const {id: panelId, config: panelConfig} = config;
  let {input_node: panelInputExpr} = config;
  const weave = useWeaveContext();
  const {stack} = usePanelContext();

  panelInputExpr = useNodeWithServerType(panelInputExpr).result;
  const {curPanelId, stackIds, handler} = usePanelStacksForType(
    panelInputExpr.type,
    panelId,
    {
      allowedPanels: props.allowedPanels,
      stackIdFilter: allowPanel,
    }
  );

  const panelOptions = useMemo(() => {
    return stackIds.map(si => {
      const isActive =
        handler != null &&
        si.displayName === getStackIdAndName(handler).displayName;
      return {
        text: si.displayName,
        value: si.id,
        key: si.id,
        active: isActive,
        selected: isActive,
      };
    });
  }, [handler, stackIds]);

  const curPanelName =
    handler != null ? getStackIdAndName(handler).displayName : '';

  const handlePanelChange = useCallback(
    async (newPanelId: string) => {
      const {id, config: newPanelConfig} = await initPanel(
        weave,
        config.input_node,
        newPanelId,
        props.allowedPanels,
        stack
      );
      updateConfig({...config, id, config: newPanelConfig});
    },
    [config, props.allowedPanels, stack, updateConfig, weave]
  );

  const initPanelForInput = useCallback(
    async (newExpression: NodeOrVoidNode) => {
      const {id, config: newPanelConfig} = await initPanel(
        weave,
        newExpression,
        undefined,
        props.allowedPanels,
        stack
      );
      updateConfig({
        ...config,
        input_node: newExpression,
        id,
        config: newPanelConfig,
      });
    },
    [config, props.allowedPanels, stack, updateConfig, weave]
  );

  const updateExpression = useCallback(
    (newExpression: NodeOrVoidNode) => {
      if (
        weave.expToString(newExpression) ===
        weave.expToString(config.input_node)
      ) {
        // If expression strings match, no update. This prevents glitching
        // when types change (which I think happens in panel composition
        // due to inconsistency between client and server detected types).
        // I don't think we have a case for updating just the type of
        // an expression at the moment, so I think this is safe.
        return;
      }

      if (isAssignableTo(newExpression.type, config.input_node.type)) {
        // If type didn't change, keep current settings
        updateConfig({...config, input_node: newExpression});
      } else if (curPanelId === 'Each') {
        // "stick" to each
        updateConfig({...config, input_node: newExpression});
      } else if (props.allowedPanels != null && config.id === 'Expression') {
        // Major hacks here. allowedPanels is currently only set in the sidebar,
        // so use that to detect if we're there.
        // Expression ends up being the default panel for new panels. So we "stick"
        // to Expression if we're in the sidebar.
        updateConfig({
          ...config,
          input_node: newExpression,
          id: 'Expression',
          config: undefined,
        });
      } else {
        // Auto panel behavior.
        initPanelForInput(newExpression);
      }
    },
    [
      weave,
      curPanelId,
      config,
      props.allowedPanels,
      updateConfig,
      initPanelForInput,
    ]
  );

  let updatePanelInput: ((newInput: Node) => void) | undefined = useCallback(
    (newInput: Node) => {
      consoleLog('UPDATE PANEL INPUT', newInput);
      let newExp: Node;
      if (
        filterNodes(
          newInput,
          checkNode =>
            checkNode.nodeType === 'var' && checkNode.varName === 'input'
        ).length === 0
      ) {
        newExp = newInput;
      } else {
        newExp = weave.callFunction(newInput, {
          input: panelInputExpr,
        });
      }
      const doUpdate = async () => {
        try {
          const refined = await weave.refineNode(newExp, stack);
          updateExpression(refined);
        } catch (e) {
          return Promise.reject(e);
        }
        return Promise.resolve();
      };
      doUpdate().catch(e => {
        console.error('PanelExpression error', e);
        throw new Error(e);
      });
    },
    [panelInputExpr, weave, stack, updateExpression]
  );
  if (props.passthroughUpdate) {
    updatePanelInput = props.updateInput;
  }
  const updateAssignment = useCallback(
    (key: string, val: NodeOrVoidNode) => {
      updateConfig({
        ...config,
        vars: {
          ...config.vars,
          [key]: val,
        },
      });
    },
    [config, updateConfig]
  );

  const updatePanelConfig2 = useCallback(
    (change: <T>(oldConfig: T) => Partial<T>) => {
      if (updateConfig2 == null) {
        return;
      }
      updateConfig2(oldConfig => {
        oldConfig = getFullChildPanel(oldConfig);
        return {
          ...oldConfig,
          id: curPanelId ?? '',
          config: {...oldConfig.config, ...change(oldConfig.config)},
        };
      });
    },
    // Added depenedency on curPanelId which depends on current
    // config state :( which ruins updateConfig2
    // TODO: fix
    [updateConfig2, curPanelId]
  );

  const updatePanelConfig = useCallback(
    newPanelConfig =>
      updateConfig({
        ...config,
        id: curPanelId ?? '',
        config: {...config.config, ...newPanelConfig},
      }),

    [config, updateConfig, curPanelId]
  );

  const newVars = useMemo(
    () => ({...config.vars, input: panelInputExpr}),
    [config.vars, panelInputExpr]
  );
  const {path: parentPath} = usePanelContext();
  // TODO: we shouldn't need this but pathEl is not always set currently.
  const path = useMemo(
    () =>
      props.pathEl != null ? parentPath.concat([props.pathEl]) : parentPath,
    [parentPath, props.pathEl]
  );

  const inputHighlighted = usePanelInputExprIsHighlightedByPath(path);

  const setPanelIsHighlightedByPath = useSetPanelInputExprIsHighlighted();
  const handleVarEvent = useCallback(
    (varName: string, target: NodeOrVoidNode, event: ExpressionEvent) => {
      consoleLog('CHILD PANEL HANDLE VAR EVENT', varName, target, event);
      if (varName === 'input') {
        if (event.id === 'hover') {
          setPanelIsHighlightedByPath(path, true);
        } else if (event.id === 'unhover') {
          setPanelIsHighlightedByPath(path, false);
        } else if (event.id === 'mutate') {
          updateExpression(replaceChainRoot(panelInputExpr, event.newRootNode));
        }
      } else {
        if (config.vars[varName] == null) {
          throw new Error(
            "Received var event for var we don't have " + varName
          );
        }
        if (event.id === 'mutate') {
          updateAssignment(
            varName,
            replaceChainRoot(config.vars[varName], event.newRootNode)
          );
        } else {
          consoleLog('ChildPanel Unhandled event for var', varName, event);
        }
      }
    },
    [
      config.vars,
      panelInputExpr,
      path,
      setPanelIsHighlightedByPath,
      updateAssignment,
      updateExpression,
    ]
  );
  const panelInput = useMemo(
    () => varNode(panelInputExpr.type, 'input'),
    [panelInputExpr.type]
  );

  const setInspectingPanel = useSetInspectingChildPanel();

  return useMemo(
    () => ({
      curPanelId,
      handler,
      panelConfig,
      panelInputExpr,
      panelInput,
      stackIds,
      newVars,
      panelOptions,
      curPanelName,
      inputHighlighted,
      updateExpression,
      handlePanelChange,
      handleVarEvent,
      updatePanelConfig,
      updatePanelConfig2,
      updatePanelInput,
      setInspectingPanel,
    }),
    [
      curPanelId,
      handler,
      panelConfig,
      panelInputExpr,
      panelInput,
      stackIds,
      newVars,
      panelOptions,
      curPanelName,
      inputHighlighted,
      updateExpression,
      handlePanelChange,
      handleVarEvent,
      updatePanelConfig,
      updatePanelConfig2,
      updatePanelInput,
      setInspectingPanel,
    ]
  );
};

// This is the standard way to render subpanels. We should migrate
// other cases to this (Table cell, SelectPanel in Facet, and probably
// PanelExpression and PanelRootQuery)
export const ChildPanel: React.FC<ChildPanelProps> = props => {
  const {
    panelInput,
    panelConfig,
    handler,
    curPanelId,
    newVars,
    panelOptions,
    // inputHighlighted,
    panelInputExpr,
    handlePanelChange,
    handleVarEvent,
    updateExpression,
    updatePanelConfig,
    updatePanelConfig2,
    updatePanelInput,
    setInspectingPanel,
  } = useChildPanelCommon(props);

  const nonExpressionPanelId = useMemo(() => {
    const nonExpressionOption = panelOptions.find(
      option => option.value !== 'Expression' && option.value !== 'RootBrowser'
    );
    if (nonExpressionOption != null) {
      return nonExpressionOption.value;
    }
    return null;
  }, [panelOptions]);

  const setToNoneExpression = useCallback(() => {
    consoleLog('SET TO NONE NOOP');
    if (nonExpressionPanelId != null) {
      handlePanelChange(nonExpressionPanelId);
    }
  }, [handlePanelChange, nonExpressionPanelId]);

  const {frame} = usePanelContext();

  const validateName = useCallback(
    (newName: string) => {
      return isValidVarName(newName) && frame[newName] == null;
    },
    [frame]
  );

  const [hoverPanel, setHoverPanel] = useState(false);

  const [expressionFocused, setExpressionFocused] = useState(false);
  const onFocusExpression = useCallback(() => {
    setExpressionFocused(true);
  }, []);
  const onBlurExpression = useCallback(() => {
    setExpressionFocused(false);
  }, []);

  return curPanelId == null || handler == null ? (
    <div>
      No panel for type {defaultLanguageBinding.printType(panelInput.type)}
    </div>
  ) : (
    <Styles.Main
      data-weavepath={props.pathEl ?? 'root'}
      onMouseEnter={() => setHoverPanel(true)}
      onMouseLeave={() => setHoverPanel(false)}>
      {props.editable && (
        <Styles.EditorBar>
          <EditorBarContent>
            {props.prefixHeader}
            {props.pathEl != null && (
              <EditorPath>
                <ValidatingTextInput
                  dataTest="panel-expression-path"
                  onCommit={props.updateName ?? (() => {})}
                  validateInput={validateName}
                  initialValue={props.pathEl}
                />{' '}
                ={' '}
              </EditorPath>
            )}
            {curPanelId !== 'Expression' && curPanelId !== 'RootBrowser' && (
              <PanelNameEditor
                value={curPanelId ?? ''}
                autocompleteOptions={panelOptions}
                setValue={handlePanelChange}
              />
            )}
            <EditorExpression data-test="panel-expression-expression">
              <WeaveExpression
                expr={panelInputExpr}
                setExpression={updateExpression}
                noBox
                truncate={!expressionFocused}
                onFocus={onFocusExpression}
                onBlur={onBlurExpression}
              />
            </EditorExpression>
            <EditorIcons visible={hoverPanel}>
              {props.prefixButtons}
              {(curPanelId === 'Expression' || curPanelId === 'RootBrowser') &&
                nonExpressionPanelId != null && (
                  <IconButton
                    // disabled={isLoading}
                    onClick={setToNoneExpression}>
                    <Icon
                      name="sliders"
                      // style={{
                      //   color: configOpen ? '#2e78c7' : 'inherit',
                      // }}
                    />
                  </IconButton>
                )}
              <Tooltip
                position="top center"
                trigger={
                  <IconButton
                    // disabled={isLoading}
                    data-test="panel-config"
                    onClick={() => setInspectingPanel(props.pathEl ?? '')}>
                    <IconPencilEdit />
                  </IconButton>
                }>
                Open panel editor
              </Tooltip>
            </EditorIcons>
          </EditorBarContent>
        </Styles.EditorBar>
      )}
      <PanelContainer>
        <PanelContextProvider
          newVars={newVars}
          handleVarEvent={handleVarEvent}
          newPath={props.pathEl}>
          <Panel
            input={panelInput}
            panelSpec={handler}
            config={panelConfig}
            updateConfig={updatePanelConfig}
            updateConfig2={updatePanelConfig2}
            updateInput={updatePanelInput}
          />
        </PanelContextProvider>
      </PanelContainer>
    </Styles.Main>
  );
};

const NEW_INSPECTOR_IMPLEMENTED_FOR = new Set([
  `plot`,
  `histogram`,
  `row`,
  `Group`,
  `Each`,
  `EachColumn`,
  `Facet`,
  `FacetTabs`,
  `LabeledItem`,
  `Sections`,
]);

export const ChildPanelConfigComp: React.FC<ChildPanelProps> = props => {
  const {
    newVars,
    panelInputExpr,
    panelInput,
    panelConfig,
    handler,
    curPanelId,
    panelOptions,
    handleVarEvent,
    handlePanelChange,
    updateExpression,
    updatePanelConfig,
    updatePanelConfig2,
    updatePanelInput,
  } = useChildPanelCommon(props);
  const config = useMemo(() => getFullChildPanel(props.config), [props.config]);

  const selectedPath = useSelectedPath();
  const {path} = usePanelContext();

  const pathStr = useMemo(() => {
    const fullPath = ['<root>', ...path, props.pathEl].filter(el => el != null);
    return fullPath.join('.');
  }, [path, props.pathEl]);
  const selectedPathStr = useMemo(() => {
    consoleLog(`selectedPath = ${JSON.stringify(selectedPath)}`);
    if (selectedPath.length === 1 && selectedPath[0] === '') {
      return '<root>';
    }
    return ['<root>', ...selectedPath!].join('.');
  }, [selectedPath]);

  // consoleLog(`selectedPath`, selectedPath, selectedPathStr);

  // Render everything along this path, and its descendants, but only show
  // the controls for this and its descendants.

  if (
    !selectedPathStr.startsWith(pathStr) &&
    !pathStr.startsWith(selectedPathStr)
  ) {
    // Off the path
    return <></>;
  }

  // If we are selected, expose controls for input expression, panel selection,
  // our config, and misc operations
  // If child is selected, render our config only
  // HAX: config component must check path for itself and passthrough
  //      as needed, for now
  const curPanelSelected =
    pathStr !== '<root>' && pathStr.startsWith(selectedPathStr);

  const dashboardConfigOptions = curPanelSelected ? (
    <>
      <ConfigPanel.ConfigOption label={`Type`}>
        <ConfigPanel.ModifiedDropdownConfigField
          value={curPanelId}
          options={panelOptions}
          onChange={(e, {value}) => {
            if (typeof value === `string` && value) {
              handlePanelChange(value);
            }
          }}
        />
      </ConfigPanel.ConfigOption>

      <VariableEditor config={config} updateConfig={updatePanelConfig} />

      {curPanelId !== 'Group' && (
        <ConfigPanel.ConfigOption label="Input" multiline>
          <PanelContextProvider
            newVars={config.vars}
            handleVarEvent={handleVarEvent}>
            <ConfigPanel.ExpressionConfigField
              expr={panelInputExpr}
              setExpression={updateExpression}
            />
          </PanelContextProvider>
        </ConfigPanel.ConfigOption>
      )}
    </>
  ) : null;

  if (curPanelId == null || handler == null) {
    return (
      <>
        {dashboardConfigOptions}
        <div>
          No panel for type {defaultLanguageBinding.printType(panelInput.type)}
        </div>
      </>
    );
  }

  return (
    <>
      {!NEW_INSPECTOR_IMPLEMENTED_FOR.has(handler.id) &&
        dashboardConfigOptions != null && (
          <ConfigSection label={`Properties`}>
            {dashboardConfigOptions}
          </ConfigSection>
        )}
      <PanelContextProvider
        newVars={newVars}
        newPath={props.pathEl}
        handleVarEvent={handleVarEvent}
        dashboardConfigOptions={dashboardConfigOptions}>
        <PanelConfigEditor
          input={panelInput}
          panelSpec={handler}
          config={panelConfig}
          updateConfig={updatePanelConfig}
          updateConfig2={updatePanelConfig2}
          updateInput={curPanelSelected ? props.updateInput : updatePanelInput}
        />
      </PanelContextProvider>
    </>
  );
};

const nextVarName = (vars: {[key: string]: any}) => {
  for (let i = 0; i < 26; i++) {
    const chr = String.fromCharCode(97 + i);
    if (vars[chr] == null) {
      return chr;
    }
  }
  return ID();
};

const MinimalEditableField = styled(EditableField)`
  margin: 0;
`;

export const VariableEditor: React.FC<{
  config: ChildPanelFullConfig;
  updateConfig: (newConfig: ChildPanelFullConfig) => void;
}> = ({config, updateConfig}) => {
  const frame: {[key: string]: NodeOrVoidNode} = {};
  const nextFrame = {...frame};
  return (
    <ConfigPanel.ConfigOption label="variables">
      <div>
        {_.map(config.vars, (value, key) => {
          const varEditor = (
            <div key={key} style={{display: 'flex', alignItems: 'center'}}>
              <MinimalEditableField
                value={key}
                placeholder="var"
                save={newVarName => {
                  const newVars: {[key: string]: any} = {};
                  for (const [k, v] of Object.entries(config.vars)) {
                    if (k === key) {
                      newVars[newVarName] = v;
                    } else {
                      newVars[k] = v;
                    }
                  }
                  updateConfig({...config, vars: newVars});
                }}
              />
              <div style={{marginRight: 4, marginLeft: 4}}>= </div>
              <div style={{flexGrow: 1}}>
                <PanelContextProvider newVars={{...nextFrame}}>
                  <WeaveExpression
                    expr={value}
                    noBox
                    // liveUpdate
                    setExpression={val =>
                      updateConfig({
                        ...config,
                        vars: {...config.vars, [key]: val},
                      })
                    }
                  />
                </PanelContextProvider>
              </div>
            </div>
          );
          nextFrame[key] = value;
          return varEditor;
        })}
        <div
          style={{cursor: 'pointer', color: linkHoverBlue}}
          onClick={() =>
            updateConfig({
              ...config,
              vars: {
                ...config.vars,
                [nextVarName(config.vars)]: voidNode(),
              },
            })
          }>
          {/* + New variable */}
        </div>
      </div>
    </ConfigPanel.ConfigOption>
  );
};

export const VariableView: React.FC<{
  newVars: {[key: string]: NodeOrVoidNode};
}> = ({newVars}) => {
  const frame = newVars;
  const weave = useWeaveContext();
  return (
    <>
      {_.map(frame, (value, key) => (
        <ConfigPanel.ConfigOption key={key} label={_.capitalize(key)}>
          {weave.expToString(value)}
        </ConfigPanel.ConfigOption>
      ))}
    </>
  );
};

export const useChildPanelProps = (
  props: PanelProps<any, any>,
  configKey: string
) => {
  const {config, updateConfig2: parentUpdateConfig2} = props;
  if (config == null) {
    throw new Error('null config invalid for child panel');
  }
  if (parentUpdateConfig2 == null) {
    throw new Error('null updateConfig2 invalid for child panel');
  }
  const updateConfig = useCallback(
    newItemConfig =>
      parentUpdateConfig2(oldConfig => {
        console.log('1. NEW ITEM CONFIG', newItemConfig);
        return {
          ...oldConfig,
          [configKey]: newItemConfig, // Don't splat with ...config.item! ChildPanel always sends full config, and sometimes restructures its shape
        };
      }),

    [parentUpdateConfig2, configKey]
  );
  const updateConfig2 = useCallback(
    (change: (oldItemConfig: any) => any) => {
      parentUpdateConfig2(oldConfig => {
        const newItemConfig = change(oldConfig[configKey]);
        console.log('NEW ITEM CONFIG', newItemConfig);
        return {
          ...oldConfig,
          panel: newItemConfig, // Don't splat with ...config.item! ChildPanel always sends full config, and sometimes restructures its shape
        };
      });
    },
    [parentUpdateConfig2, configKey]
  );

  return {
    pathEl: configKey,
    config: config[configKey],
    updateConfig,
    updateConfig2,
  };
};

const EditorBarContent = styled.div`
  display: flex;
  align-items: flex-start;
  width: calc(100% + 16px);
  flex-shrink: 0;
  position: relative;
  left: -8px;
  padding: 0 16px 8px;
  border-bottom: 1px solid ${GRAY_350};
  margin-bottom: 8px;
  line-height: 20px;
`;

const EditorPath = styled.div`
  white-space: nowrap;
  margin-right: 8px;

  input {
    font-family: inherit;
  }
`;

const EditorExpression = styled.div`
  flex-grow: 1;
  margin-left: 4px;
  overflow: hidden;
  &:hover {
    background-color: ${GRAY_50};
  }
`;

const EditorIcons = styled.div<{visible: boolean}>`
  height: 20px;
  display: flex;
  align-items: center;
  margin-left: 8px;
  visibility: ${p => (p.visible ? `visible` : `hidden`)};
`;

const Tooltip = styled(Popup).attrs({
  basic: true, // This removes the pointing arrow.
  mouseEnterDelay: 500,
  popperModifiers: {
    preventOverflow: {
      // Prevent popper from erroneously constraining the popup.
      // Without this, tooltips in single row table cells get positioned under the cursor,
      // causing them to immediately close.
      boundariesElement: 'viewport',
    },
  },
})`
  && {
    color: ${Colors.WHITE};
    background: ${Colors.GRAY_800};
    border-color: ${Colors.GRAY_700};
    box-shadow: 0px 4px 6px ${hexToRGB(Colors.BLACK, 0.2)};
    font-size: 14px;
    line-height: 140%;
    max-width: 300px;
  }
`;

const PanelContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
`;
