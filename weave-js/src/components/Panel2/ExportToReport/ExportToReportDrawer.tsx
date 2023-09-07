import * as w from '@wandb/weave/core';
import {constNone, constString} from '@wandb/weave/core';
import _ from 'lodash';
import {useEffect, useState} from 'react';
import {Button} from 'semantic-ui-react';
import {useMutation, useNodeValue} from '../../../react';
import {useBranchPointFromURIString} from '../../PagePanelComponents/hooks';
import {determineURISource, uriFromNode} from '../../PagePanelComponents/util';
import {Tailwind} from '../../Tailwind';
import {ChildPanelFullConfig} from '../ChildPanel';
import {
  useClosePanelInteractDrawer,
  useSelectedPath,
} from '../PanelInteractContext';
import {getConfigForPath} from '../panelTree';
import React from 'react';
import {ReportSelection} from './ReportSelection';
import {useEntityAndProject} from './useEntityAndProject';
import {useHistory} from 'react-router-dom';
import {navigateToReport} from './navigateToReport';

const CREATE_NEW_REPORT_OPTION = 'Create new report';

const DEFAULT_REPORT_OPTION = {
  id: null,
  name: CREATE_NEW_REPORT_OPTION,
};

export const ExportToReportDrawer = ({
  config,
}: {
  config: ChildPanelFullConfig;
}) => {
  const history = useHistory();

  const {entityName, projectName} = useEntityAndProject(config);

  useEffect(() => {
    setSelectedEntityName(entityName);
    setSelectedProjectName(projectName);
  }, [entityName, projectName]);

  const [selectedEntityName, setSelectedEntityName] = useState(entityName);
  const [selectedProjectName, setSelectedProjectName] = useState(projectName);
  const [selectedReport, setSelectedReport] = useState(DEFAULT_REPORT_OPTION);

  const selectedPath = useSelectedPath();
  const localConfig = getConfigForPath(config.config, selectedPath);
  const exportPanelToReport = useMutation(
    localConfig.input_node, // TODO: handle Group panels
    'export_panel_to_report'
  );

  const [submitting, setSubmitting] = useState(false);

  const closePanelInteractDrawer = useClosePanelInteractDrawer();

  return (
    <Tailwind style={{height: '100%'}}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-moon-250 px-16 py-12">
          <h2 className="text-lg font-semibold">
            Add {_.last(selectedPath)} to report
          </h2>
          <Button
            icon="close"
            variant="ghost"
            onClick={closePanelInteractDrawer}
          />
        </div>
        {selectedEntityName && selectedProjectName && (
          <ReportSelection
            config={config}
            selectedEntityName={selectedEntityName}
            selectedProjectName={selectedProjectName}
            selectedReport={selectedReport}
            setSelectedEntityName={setSelectedEntityName}
            setSelectedProjectName={setSelectedProjectName}
            setSelectedReport={setSelectedReport}
          />
        )}
        <div className="border-t border-moon-250 px-16 py-20">
          <Button
            icon="add-new"
            className="w-full"
            disabled={submitting}
            onClick={async () => {
              let draftId = '';
              try {
                setSubmitting(true);
                await exportPanelToReport({
                  entity_name: constString(selectedEntityName),
                  project_name: constString(selectedProjectName),
                  report_id: selectedReport.id
                    ? constString(selectedReport.id)
                    : constNone(),
                  panel_id: localConfig.id
                    ? constString(localConfig.id)
                    : constNone(),
                });
                closePanelInteractDrawer();
              } catch (err) {
                // TODO: handle error
                console.error(err);
              } finally {
                setSubmitting(false);
                // TODO: open in new tab
                console.log(draftId);
                // navigateToReport({
                //   history,
                //   entityName,
                //   projectName,
                //   reportId: selectedReport.id,
                //   reportName: selectedReport.name,
                //   draft: true,
                //   opts: {newTab: true},
                // });
              }
            }}>
            {submitting ? 'Adding panel...' : 'Add panel'}
          </Button>
        </div>
      </div>
    </Tailwind>
  );
};
