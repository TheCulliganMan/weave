import React, {useState} from 'react';
import * as w from '@wandb/weave/core';

import config from '../../../config';
import {useNodeValue} from '../../../react';
import {useBranchPointFromURIString} from '../../PagePanelComponents/hooks';
import {uriFromNode, determineURISource} from '../../PagePanelComponents/util';
import {ChildPanelFullConfig} from '../ChildPanel';
import {useEntityAndProject} from './useEntityAndProject';
import {Select} from './Select';

const CREATE_NEW_REPORT_OPTION = 'Create new report';

export const ReportSelection = ({config}: {config: ChildPanelFullConfig}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const {entityName} = useEntityAndProject(config);
  const [selectedEntityName, setSelectedEntityName] = useState(entityName);
  const [selectedReport, setSelectedReport] = useState({
    id: 'create-new-report',
    name: CREATE_NEW_REPORT_OPTION,
  });

  // Get all of user's entities
  const entitiesNode = w.opUserEntities({user: w.opRootViewer({})});
  const entitiesMetaNode = w.opMap({
    arr: entitiesNode,
    mapFn: w.constFunction({row: 'entity'}, ({row}) => {
      return w.opDict({
        id: w.opEntityInternalId({entity: row}),
        name: w.opEntityName({entity: row}),
      } as any);
    }),
  });
  const entityNames = useNodeValue(entitiesMetaNode);

  // Get the reports for the selected entity
  const entityNode = w.opRootEntity({
    entityName: w.constString(selectedEntityName),
  });
  const reportsNode = w.opEntityReports({
    entity: entityNode,
  });
  const reportsMetaNode = w.opMap({
    arr: reportsNode,
    mapFn: w.constFunction({row: 'report'}, ({row}) => {
      return w.opDict({
        id: w.opReportInternalId({report: row}),
        name: w.opReportName({report: row}),
      } as any);
    }),
  });
  const reports = useNodeValue(reportsMetaNode);

  console.log('**entityNames', entityNames);
  console.log('**reports', reports);

  return (
    <div className="flex-1 p-16">
      <label
        htmlFor="destination-report"
        className="mb-4 block font-semibold text-moon-800">
        Destination report
      </label>

      <Select<string, false>
        // size="small"
        aria-label="entity selector"
        // defaultInputValue={selectedEntityName}
        menuIsOpen={isMenuOpen}
        onMenuOpen={() => setIsMenuOpen(true)}
        onMenuClose={() => setIsMenuOpen(false)}
        options={entityNames.result}
        formatOptionLabel={option => option.name}
        value={{name: selectedEntityName}}
        onChange={selected => {
          console.log(selected);
          setSelectedEntityName(selected.name);
        }}
        // components={customSelectComponents}
        isSearchable={false}
      />
      <Select<string, false>
        // size="small"
        aria-label="entity selector"
        // defaultInputValue={selectedEntityName}
        menuIsOpen={isMenuOpen}
        onMenuOpen={() => setIsMenuOpen(true)}
        onMenuClose={() => setIsMenuOpen(false)}
        options={reports.result}
        formatOptionLabel={option => option.name}
        value={{name: selectedReport.name}}
        onChange={selected => {
          console.log(selected);
          setSelectedReport(selected);
        }}
        // components={customSelectComponents}
        isSearchable={false}
      />
      {/* <input
        id="destination-report"
        className="block w-full rounded border border-moon-250 px-10 py-5"
        value={selectedEntityName}
        onChange={e => setSelectedEntityName(e.target.value)}
        placeholder="Report ID"
      /> */}
      <p className="mt-16 text-moon-500">
        Future changes to the board will not affect exported panels inside
        reports.
      </p>
    </div>
  );
};
