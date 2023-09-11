import React, {useEffect, useState} from 'react';
import * as w from '@wandb/weave/core';

import config from '../../../config';
import {useNodeValue} from '../../../react';
import {useBranchPointFromURIString} from '../../PagePanelComponents/hooks';
import {uriFromNode, determineURISource} from '../../PagePanelComponents/util';
import {ChildPanelFullConfig} from '../ChildPanel';
import {useEntityAndProject} from './useEntityAndProject';
import {Select} from './Select';
import {report} from 'process';
import {constFunction} from '@wandb/weave/core';
import {isPanel} from '../../WeavePanelBank/panelbank';

const CREATE_NEW_REPORT_OPTION = 'Create new report';
const DEFAULT_REPORT_OPTION = {
  id: null,
  name: CREATE_NEW_REPORT_OPTION,
};

type ReportSelectionProps = {
  config: ChildPanelFullConfig;
  selectedEntityName: string;
  selectedProjectName: any;
  selectedReport: any;
  setSelectedProjectName: any;
  setSelectedEntityName: any;
  setSelectedReport: any;
};

// selectedEntityName = '',
// selectedProjectName = '',
// selectedReport = {id: '', name: ''},
// setSelectedEntityName,
// setSelectedProjectName,
// setSelectedReport,
export const ReportSelection = ({config}: ReportSelectionProps) => {
  const [isEntityMenuOpen, setIsEntityMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);

  const {entityName, projectName} = useEntityAndProject(config);

  // console.log({entityName, projectName});
  const [selectedEntityName, setSelectedEntityName] = useState(entityName);
  const [selectedProjectName, setSelectedProjectName] = useState(projectName);
  const [selectedReport, setSelectedReport] = useState(DEFAULT_REPORT_OPTION);

  // Get all of user's entities - can move this out
  // const entitiesNode = w.opUserEntities({user: w.opRootViewer({})});
  const entitiesMetaNode = w.opMap({
    arr: w.opUserEntities({user: w.opRootViewer({})}),
    mapFn: w.constFunction({row: 'entity'}, ({row}) => {
      return w.opDict({
        id: w.opEntityInternalId({entity: row}),
        name: w.opEntityName({entity: row}),
      } as any);
    }),
  });
  const entityNames = useNodeValue(entitiesMetaNode);
  const entityNode = w.opRootEntity({
    entityName: w.constString(selectedEntityName),
  });
  // Get all of entity's project
  const projectsNode = w.opEntityProjects({
    entity: entityNode,
  });
  const projectsMetaNode = w.opMap({
    arr: projectsNode,
    mapFn: w.constFunction({row: 'entity'}, ({row}) => {
      return w.opDict({
        id: w.opProjectInternalId({entity: row}),
        name: w.opProjectName({entity: row}),
        // reports: w.opProjectReports({project: row}),
      } as any);
    }),
  });
  // List of projects
  const projects = useNodeValue(projectsMetaNode, {
    skip: selectedEntityName == null || entityNames.loading,
  });

  // THESE ARE EQUIVALENT
  // const reportsNode = w.opProjectReports({
  //   project: entityNode, // USES ENTITY NODE INSTEAD OF PROJECT
  // });
  const reportsNode = w.opEntityReports({
    enity: entityNode,
  });

  const reportsMetaNode = w.opMap({
    arr: reportsNode,
    mapFn: w.constFunction({row: 'report'}, ({row}) => {
      return w.opDict({
        id: w.opReportInternalId({report: row}),
        name: w.opReportName({report: row}),
        projectName: w.opProjectName({
          project: w.opReportProject({report: row}),
        }),
      } as any);
    }),
  });
  const filteredReportsMetaNode = w.opFilter({
    arr: reportsMetaNode,
    filterFn: constFunction(
      {row: w.listObjectType(reportsMetaNode.type)},
      ({row}) => {
        return w.opStringEqual({
          lhs: w.opPick({
            obj: row,
            key: w.constString('projectName'),
          }),
          rhs: w.constString(selectedProjectName),
        });
      }
    ),
  });
  const reports = useNodeValue(filteredReportsMetaNode);

  // TODO - loading
  return (
    <div className="flex-1 gap-8 p-16">
      <label
        htmlFor="entity"
        className="mb-4 block font-semibold text-moon-800">
        Destination entity
      </label>
      <Select<string, false>
        // size="small"
        className="mb-8"
        aria-label="entity selector"
        isLoading={entityNames.loading}
        // defaultInputValue={selectedEntityName}
        menuIsOpen={isEntityMenuOpen}
        onMenuOpen={() => setIsEntityMenuOpen(true)}
        onMenuClose={() => setIsEntityMenuOpen(false)}
        options={entityNames.result ?? []}
        formatOptionLabel={option => option.name}
        value={{name: selectedEntityName ?? ''}}
        onChange={selected => {
          console.log(selected);
          setSelectedEntityName(selected.name);
          setSelectedReport(DEFAULT_REPORT_OPTION);
        }}
        // components={customSelectComponents}
        isSearchable={false}
      />
      <label
        htmlFor="entity"
        className="mb-4 block font-semibold text-moon-800">
        Destination project
      </label>
      <Select<string, false>
        // size="small"
        className="mb-8"
        aria-label="project selector"
        isLoading={projects.loading}
        // defaultInputValue={selectedEntityName}
        menuIsOpen={isProjectMenuOpen}
        onMenuOpen={() => setIsProjectMenuOpen(true)}
        onMenuClose={() => setIsProjectMenuOpen(false)}
        options={projects.result ?? []}
        formatOptionLabel={option => option.name}
        value={{name: selectedProjectName}}
        onChange={selected => {
          console.log(selected);
          setSelectedProjectName(selected.name);
          setSelectedReport(DEFAULT_REPORT_OPTION);
        }}
        // components={customSelectComponents}
        isSearchable={false}
      />
      <label
        htmlFor="destination-report"
        className="mb-4 block font-semibold text-moon-800">
        Destination report
      </label>
      <Select<string, false>
        // size="small"
        className="mb-8"
        aria-label="report selector"
        isLoading={reports.loading}
        // defaultInputValue={selectedEntityName}
        menuIsOpen={isReportMenuOpen}
        onMenuOpen={() => setIsReportMenuOpen(true)}
        onMenuClose={() => setIsReportMenuOpen(false)}
        options={[DEFAULT_REPORT_OPTION, ...(reports.result ?? [])]}
        formatOptionLabel={option => option.name}
        value={{name: selectedReport.name}}
        onChange={selected => {
          console.log(selected);
          setSelectedReport(selected);
        }}
        // components={customSelectComponents}
        isSearchable={false}
      />
      <p className="mt-16 text-moon-500">
        Future changes to the board will not affect exported panels inside
        reports.
      </p>
    </div>
  );
};
