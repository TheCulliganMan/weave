import _ from 'lodash';
import memoize from 'memoize-one';
import React, {
  CSSProperties,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dropdown,
  DropdownItemProps,
  Icon,
  Label,
  StrictDropdownProps,
} from 'semantic-ui-react';
import {LabelProps} from 'semantic-ui-react';

import {
  DragDropProvider,
  DragDropState,
  DragHandle,
  DragSource,
  DropTarget,
} from '../../containers/DragDropContainer';
import {gray800} from '../../css/globals.styles';
import {usePrevious} from '../../state/hooks';
import {Omit} from '../../types/base';
import {makePropsAreEqual} from '../../util/shouldUpdate';
import {Struct} from '../../util/types';
import {Option} from '../../util/uihelpers';
import {RemovableTag, RemoveAction} from '@wandb/weave/components/Tag';
import styled from 'styled-components';

type LabelCoord = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const ITEM_LIMIT_VALUE = '__item_limit';

const simpleSearch = (options: DropdownItemProps[], query: string) => {
  return _.chain(options)
    .filter(o =>
      _.includes(JSON.stringify(o.text).toLowerCase(), query.toLowerCase())
    )
    .sortBy(o => {
      const valJSON = typeof o.text === 'string' ? `"${query}"` : query;
      return JSON.stringify(o.text).toLowerCase() === valJSON.toLowerCase()
        ? 0
        : 1;
    })
    .value();
};

export interface ModifiedDropdownExtraProps {
  debounceTime?: number;
  enableReordering?: boolean;
  itemLimit?: number;
  options: Option[];
  resultLimit?: number;
  style?: CSSProperties;

  optionTransform?(option: Option): Option;
}

type ModifiedDropdownProps = Omit<StrictDropdownProps, 'options'> &
  ModifiedDropdownExtraProps;

const ModifiedDropdown: FC<ModifiedDropdownProps> = React.memo(
  (props: ModifiedDropdownProps) => {
    const {
      allowAdditions,
      debounceTime,
      enableReordering,
      itemLimit,
      multiple,
      onChange,
      options: propsOptions,
      optionTransform,
      search,
      value,
    } = props;
    const resultLimit = props.resultLimit ?? 100;
    const [searchQuery, setSearchQuery] = useState('');
    const [options, setOptions] = useState(propsOptions);

    const doSearch = useMemo(
      () =>
        _.debounce((query: string) => {
          // in multi-select mode, we have to include all the filtered out selected
          // keys or they won't be rendered
          const currentOptions: Option[] = [];
          if (multiple && Array.isArray(value)) {
            const values = value;
            propsOptions.forEach(opt => {
              if (values.find(v => v === opt.value)) {
                currentOptions.push(opt);
              }
            });
          }

          if (search instanceof Function) {
            setOptions(
              _.concat(currentOptions, search(propsOptions, query) as Option[])
            );
          } else {
            setOptions(
              _.concat(
                currentOptions,
                simpleSearch(propsOptions, query) as Option[]
              )
            );
          }
        }, debounceTime || 400),
      [multiple, propsOptions, search, value, debounceTime]
    );

    const firstRenderRef = useRef(true);
    const prevDoSearch = usePrevious(doSearch);
    useEffect(() => {
      if (firstRenderRef.current) {
        return;
      }
      doSearch(searchQuery);
      if (prevDoSearch !== doSearch) {
        prevDoSearch?.cancel();
        doSearch.flush();
      }
      // eslint-disable-next-line
    }, [searchQuery, doSearch]);
    useEffect(() => {
      firstRenderRef.current = false;
    }, []);

    const getDisplayOptions = memoize(
      (
        displayOpts: Option[],
        limit: number,
        query: string,
        val: StrictDropdownProps['value']
      ) => {
        const origOpts = displayOpts;
        displayOpts = displayOpts.slice(0, limit);
        if (optionTransform) {
          displayOpts = displayOpts.map(optionTransform);
        }

        let selectedVals = val;
        if (allowAdditions && query !== '') {
          selectedVals = query;
        }

        if (selectedVals != null && (allowAdditions || query === '')) {
          if (!_.isArray(selectedVals)) {
            selectedVals = [selectedVals];
          }
          for (const v of selectedVals) {
            if (!_.find(displayOpts, o => o.value === v)) {
              let option = origOpts.find(o => o.value === v) ?? {
                key: v,
                text: v,
                value: v,
              };
              if (optionTransform) {
                option = optionTransform(option);
              }
              displayOpts.unshift(option);
            }
          }
        }

        if (options.length > resultLimit) {
          displayOpts.push({
            key: ITEM_LIMIT_VALUE,
            text: (
              <span className="hint-text">
                Limited to {resultLimit} items. Refine search to see other
                options.
              </span>
            ),
            value: ITEM_LIMIT_VALUE,
          });
        }

        return displayOpts;
      }
    );

    const itemCount = useCallback(() => {
      let count = 0;
      if (value != null && _.isArray(value)) {
        count = value.length;
      }
      return count;
    }, [value]);

    const atItemLimit = useCallback(() => {
      if (itemLimit == null) {
        return false;
      }
      return itemCount() >= itemLimit;
    }, [itemLimit, itemCount]);

    const displayOptions = getDisplayOptions(
      searchQuery ? options : propsOptions,
      resultLimit,
      searchQuery,
      value
    );

    const canReorder = Boolean(multiple && enableReordering);
    const [draggingID, setDraggingID] = useState<string | null>(null);
    const [dropBefore, setDropBefore] = useState<string | null>(null);
    const [dropAfter, setDropAfter] = useState<string | null>(null);
    const labelEls = useRef<Struct<Element>>({});

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const updateDragoverMouseCoords = useCallback(
      canReorder
        ? _.throttle((ctx: DragDropState, e: DragEvent) => {
            const [x, y] = [e.clientX, e.clientY];

            const coordEntries: Array<[string, LabelCoord]> = Object.entries(
              labelEls.current
            ).map(([id, el]) => {
              const {top, bottom, left, right} = el.getBoundingClientRect();
              return [
                id,
                {
                  top: top + 2,
                  bottom: bottom + 2,
                  left,
                  right,
                },
              ];
            });
            const sortedCoordEntriesByX = _.sortBy(
              coordEntries,
              ([id, {left}]) => -left
            );
            const coordEntriesByY = _.groupBy(
              sortedCoordEntriesByX,
              ([id, {top}]) => top
            );
            const sortedCoordEntriesByY = _.sortBy(
              Object.entries(coordEntriesByY),
              ([rowTop]) => Number(rowTop)
            );

            for (const [, rowEntries] of sortedCoordEntriesByY) {
              const {top: rowTop, bottom: rowBottom} = rowEntries[0][1];
              if (y < rowTop || y > rowBottom) {
                continue;
              }
              for (const [id, {left, right}] of rowEntries) {
                const center = (left + right) / 2;
                if (x > center) {
                  setDropBefore(null);
                  setDropAfter(id);
                  return;
                }
              }
              setDropBefore(_.last(rowEntries)![0]);
              setDropAfter(null);
              return;
            }

            setDropBefore(null);
            setDropAfter(null);
          }, 50)
        : () => {},
      [canReorder]
    );

    const onDragEnd = (ctx: DragDropState, e: React.DragEvent<HTMLElement>) => {
      if (!canReorder) {
        return;
      }
      if ('cancel' in updateDragoverMouseCoords) {
        updateDragoverMouseCoords.cancel();
      }
      setDropBefore(null);
      setDropAfter(null);
      if (
        onChange == null ||
        !Array.isArray(value) ||
        draggingID == null ||
        (dropBefore == null && dropAfter == null) ||
        dropBefore === draggingID ||
        dropAfter === draggingID
      ) {
        return;
      }
      const newValue: typeof value = [];
      for (const v of value) {
        if (v === draggingID) {
          continue;
        }
        if (v === dropBefore) {
          newValue.push(draggingID);
        }
        newValue.push(v);
        if (v === dropAfter) {
          newValue.push(draggingID);
        }
      }
      onChange(e, {value: newValue});
    };

    const renderLabel = (
      item: DropdownItemProps,
      index: number,
      defaultLabelProps: LabelProps
    ) => {
      const onRemove = defaultLabelProps.onRemove!;
      const dragID = String(item.value);
      const dragRef = {id: dragID};

      const dragDropLabelStyle = {
        userSelect: 'none',
        padding: '.3125em .8125em',
        margin: 0,
        boxShadow: 'inset 0 0 0 1px rgb(34 36 38 / 15%)',
        fontSize: '1em',
        cursor: 'move',
      };

      const labelText = item.text ?? '';
      const tagLabel = (
        <LabelTagContainer>
          <RemovableTag
            label={labelText as string}
            color="teal"
            removeAction={
              <RemoveAction
                onClick={(e: React.MouseEvent<HTMLElement, MouseEvent>) => {
                  onRemove(e, defaultLabelProps);
                }}
              />
            }
          />
        </LabelTagContainer>
      );

      const label = (
        <Label
          {...defaultLabelProps}
          style={{
            ...(canReorder ? dragDropLabelStyle : {}),
            position: 'relative',
            paddingRight: 32,
            maxWidth: '100%',
            verticalAlign: 'top',
            wordWrap: 'break-word',
          }}
          className="multi-group-label"
          data-test="modified-dropdown-label">
          {item.text}
          <Icon
            style={{position: 'absolute', right: 13, top: 6}}
            onClick={(e: React.MouseEvent<HTMLElement, MouseEvent>) =>
              onRemove(e, defaultLabelProps)
            }
            name="delete"
            data-test="modified-dropdown-label-delete"
          />
        </Label>
      );

      const wrapLabelWithDragDrop = (children: React.ReactNode) => (
        <DragSource
          onDragStart={() => setDraggingID(dragID)}
          onDragEnd={onDragEnd}
          callbackRef={el => (labelEls.current[dragID] = el)}
          partRef={dragRef}
          style={{
            display: 'inline-block',
            verticalAlign: 'top',
            margin: '.125rem .25rem .125rem 0',
            position: 'relative',
            maxWidth: '100%',
          }}>
          {dropBefore === dragID && (
            <div
              style={{
                position: 'absolute',
                width: 1,
                top: 2,
                bottom: 2,
                left: -2,
                backgroundColor: gray800,
              }}
            />
          )}
          {dropAfter === dragID && (
            <div
              style={{
                position: 'absolute',
                width: 1,
                top: 2,
                bottom: 2,
                right: -2,
                backgroundColor: gray800,
              }}
            />
          )}
          <DragHandle partRef={dragRef} style={{maxWidth: '100%'}}>
            {children}
          </DragHandle>
        </DragSource>
      );

      return canReorder
        ? wrapLabelWithDragDrop(label)
        : multiple
        ? tagLabel
        : label;
    };

    const wrapWithDragDrop = (children: React.ReactNode) =>
      canReorder ? (
        <DragDropProvider onDocumentDragOver={updateDragoverMouseCoords}>
          <DropTarget
            partRef={{id: 'modified-dropdown-drop-target'}}
            style={{position: 'relative'}}>
            {children}
          </DropTarget>
        </DragDropProvider>
      ) : (
        <>{children}</>
      );

    const passProps = {...props};
    delete passProps.itemLimit;
    delete passProps.optionTransform;
    delete passProps.allowAdditions;

    return wrapWithDragDrop(
      <Dropdown
        {...passProps}
        options={displayOptions}
        lazyLoad
        selectOnNavigation={false}
        searchQuery={searchQuery}
        search={opts => opts}
        renderLabel={renderLabel}
        onSearchChange={(e, data) => {
          props.onSearchChange?.(e, data);
          if (!atItemLimit()) {
            setSearchQuery(data.searchQuery);
          }
        }}
        onChange={(e, {value: val}) => {
          setSearchQuery('');
          const valCount = _.isArray(val) ? val.length : 0;
          if (valCount < itemCount() || !atItemLimit()) {
            if (onChange && val !== ITEM_LIMIT_VALUE) {
              onChange(e, {value: val});
            }
          }
        }}
      />
    );
  },
  makePropsAreEqual({
    name: 'ModifiedDropdown',
    deep: ['options'],
  })
);

const LabelTagContainer = styled.div`
  margin-right: 8px;
  font-size: 15px;
`;

export default ModifiedDropdown;
