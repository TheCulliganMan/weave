import React, {useCallback, useMemo} from 'react';
import _ from 'lodash';

import {
  constString,
  defaultLanguageBinding,
  escapeDots,
  isAssignableTo,
  isTypedDictLike,
  opObjGetAttr,
  opPick as actualOpPick,
  typedDictPropertyTypes,
  varNode,
  isObjectType,
  Node,
  unionObjectTypeAttrTypes,
  isObjectTypeLike,
  Type,
  nonNullable,
  opIsNone,
} from '@wandb/weave/core';

import {Icon} from 'semantic-ui-react';
import {useWeaveContext} from '../../context';
import * as Panel2 from './panel';
import * as KeyValTable from './KeyValTable';
import {PanelString, Spec as PanelStringSpec} from './PanelString';
import {PanelNumber, Spec as PanelNumberSpec} from './PanelNumber';
import {Spec as PanelDateSpec} from './PanelDate';
import PanelDate from './PanelDate/Component';
import * as ConfigPanel from './ConfigPanel';
import {useNodeValue} from '@wandb/weave/react';

const inputType = {
  type: 'union' as const,
  members: [
    {type: 'typedDict' as const, propertyTypes: {}},
    {type: 'Object' as const, _is_object: true as const},
  ],
};

export interface ObjectConfig {
  propLimit?: number;
  expanded?: boolean;
  children: {[key: string]: any};
}

type PanelObjectProps = Panel2.PanelProps<typeof inputType, ObjectConfig> & {
  level?: number;
};

const PanelObjectConfig: React.FC<PanelObjectProps> = props => {
  const {config, updateConfig} = props;
  const updateLimit = useCallback(
    (propLimit: number) => {
      updateConfig({
        ...config,
        propLimit,
      });
    },
    [updateConfig, config]
  );

  return (
    <ConfigPanel.ConfigOption label={'Field limit'}>
      <ConfigPanel.ModifiedDropdownConfigField
        selection
        allowAdditions
        options={[
          {
            text: '10',
            value: 10,
          },
          {
            text: '50',
            value: 50,
          },
          {
            text: '100',
            value: 100,
          },
          {
            text: '200',
            value: 200,
          },
          {
            text: '500',
            value: 500,
          },
          {
            text: 'No limit',
            value: Infinity,
          },
        ]}
        value={config?.propLimit ?? 100}
        onChange={(e, {value}) => {
          let newValue = Math.max(1, Number(value));
          if (isNaN(newValue)) {
            newValue = 1;
          }
          updateLimit(newValue);
        }}
      />
    </ConfigPanel.ConfigOption>
  );
};
const typeIsRenderableByPanelObject = (type: Type): boolean => {
  type = nonNullable(type);
  return isTypedDictLike(type) || isObjectTypeLike(type);
};

export const PanelObject: React.FC<PanelObjectProps> = props => {
  const {config, updateConfig} = props;
  const level = props.level ?? 0;
  const weave = useWeaveContext();
  const {updateInput: updateInputFromProps} = props;
  const nonNullableInput = nonNullable(props.input.type);

  const inputVar = useMemo(
    () => varNode(props.input.type, 'input'),
    [props.input.type]
  );

  // This is needed because dict(str, Any) is assignable to the input type
  // of this panel, but we cant render that with a PanelObject at the moment
  // so we have this more restrictive type checker to ensure we do not try to
  // render dicts the same way that we would render true typedDicts.

  const {objPropTypes, pickOrGetattr} = useMemo(() => {
    if (isTypedDictLike(nonNullableInput)) {
      return {
        objPropTypes: typedDictPropertyTypes(nonNullableInput),
        pickOrGetattr: (objNode: Node, key: string) =>
          actualOpPick({obj: objNode, key: constString(key)}),
      };
    } else if (isObjectTypeLike(nonNullableInput)) {
      return {
        objPropTypes: unionObjectTypeAttrTypes(nonNullableInput),
        pickOrGetattr: (objNode: Node, key: string) =>
          opObjGetAttr({self: objNode, name: constString(key)}),
      };
    } else {
      // Unions are not supported, but we should not error
      return {
        objPropTypes: {},
        pickOrGetattr: (objNode: Node, key: string) => {
          throw new Error('Invalid input type');
        },
      };
    }
  }, [nonNullableInput]);
  const propertyTypes = _.mapKeys(objPropTypes, (v, k) => escapeDots(k));

  const propLimit = props.config?.propLimit ?? 100;

  const keys = useMemo(() => {
    const allKeys = Object.keys(propertyTypes);
    if (allKeys.length > propLimit) {
      return allKeys.slice(0, propLimit);
    } else {
      return allKeys;
    }
  }, [propLimit, propertyTypes]);

  const updateInput = useCallback(
    (key, newInput) => {
      if (newInput == null) {
        return updateInputFromProps?.(pickOrGetattr(inputVar, key) as any);
      } else {
        const input = pickOrGetattr(inputVar, key);
        const innerFunction = weave.callFunction((newInput as any).path, {
          input,
        });
        return updateInputFromProps?.(innerFunction as any);
      }
    },
    [inputVar, pickOrGetattr, updateInputFromProps, weave]
  );

  const keyChildren = useMemo(
    () =>
      _.sortBy(keys, k => {
        const kType = nonNullable(propertyTypes[k]!);
        return isAssignableTo(kType, PanelStringSpec.inputType) ||
          isAssignableTo(kType, PanelNumberSpec.inputType) ||
          isAssignableTo(kType, PanelDateSpec.inputType) ||
          typeIsRenderableByPanelObject(kType)
          ? 0
          : 1;
      }).map(k => {
        const childNode = pickOrGetattr(props.input, k);
        return (
          <PanelObjectChild
            key={k}
            {...props}
            k={k}
            level={level}
            childNode={childNode}
            childType={propertyTypes[k]!}
            updateInput={updateInput}
          />
        );
      }),
    [keys, level, pickOrGetattr, propertyTypes, props, updateInput]
  );
  const defaultExpanded = !isObjectType(nonNullableInput) || level === 0;
  const expanded = props.config?.expanded ?? defaultExpanded;

  const toggleExpanded = useCallback(() => {
    updateConfig({
      ...config,
      expanded: !expanded,
    });
  }, [updateConfig, config, expanded]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
      }}>
      <KeyValTable.Table>
        {isObjectType(nonNullableInput) && (
          <div
            style={{display: 'flex', alignItems: 'center'}}
            onClick={() => toggleExpanded()}>
            <Icon size="mini" name={`chevron ${expanded ? 'down' : 'right'}`} />
            {nonNullableInput.type}
          </div>
        )}
        {expanded && <KeyValTable.Rows>{keyChildren}</KeyValTable.Rows>}
      </KeyValTable.Table>
    </div>
  );
};

const PanelObjectChild: React.FC<
  {
    k: string;
    level: number;
    childNode: Node;
    childType: Type;
    updateInput: (key: any, newInput: any) => void | undefined;
  } & Omit<PanelObjectProps, 'updateInput'>
> = ({
  k,
  level,
  childNode,
  childType,
  updateInput,
  context,
  updateContext,
  updateConfig,
  config,
}) => {
  const nonNullableChildType = nonNullable(childType);
  const isNone = useNodeValue(opIsNone({val: childNode}));
  if (isNone.loading || isNone.result) {
    return null;
  }
  return (
    <KeyValTable.Row>
      <KeyValTable.Key>
        <KeyValTable.InputUpdateLink onClick={() => updateInput(k, null)}>
          {k}
        </KeyValTable.InputUpdateLink>
      </KeyValTable.Key>
      <KeyValTable.Val>
        {isAssignableTo(nonNullableChildType, PanelStringSpec.inputType) ? (
          <PanelString
            input={childNode as any}
            context={context}
            updateContext={updateContext}
            // Get rid of updateConfig
            updateConfig={() => {}}
          />
        ) : isAssignableTo(nonNullableChildType, PanelNumberSpec.inputType) ? (
          <PanelNumber
            input={childNode as any}
            context={context}
            updateContext={updateContext}
            // Get rid of updateConfig
            updateConfig={() => {}}
          />
        ) : isAssignableTo(nonNullableChildType, PanelDateSpec.inputType) ? (
          <PanelDate
            input={childNode as any}
            context={context}
            updateContext={updateContext}
            // Get rid of updateConfig
            updateConfig={() => {}}
          />
        ) : typeIsRenderableByPanelObject(nonNullableChildType) ? (
          <PanelObject
            input={childNode as any}
            level={level + 1}
            config={config?.children?.[k]}
            context={context}
            updateContext={updateContext}
            // Get rid of updateConfig
            updateConfig={newChildConfig =>
              updateConfig({
                ...config,
                children: {
                  ...config?.children,
                  [k]: newChildConfig,
                },
              })
            }
            updateInput={newInput => updateInput(k, newInput)}
          />
        ) : (
          <div>{defaultLanguageBinding.printType(childType, true)}</div>
        )}
      </KeyValTable.Val>
    </KeyValTable.Row>
  );
};

export const Spec: Panel2.PanelSpec = {
  id: 'object',
  Component: PanelObject,
  ConfigComponent: PanelObjectConfig,
  inputType,
};
