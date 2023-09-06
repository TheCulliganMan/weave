import * as w from '@wandb/weave/core';
import {constNone, constString} from '@wandb/weave/core';
import _ from 'lodash';
import {useState} from 'react';
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

export const ExportToReportDrawer = ({
  config,
}: {
  config: ChildPanelFullConfig;
}) => {
  const [reportId, setReportId] = useState('Vmlldzo0MDI1NjI2');

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
        <ReportSelection config={config} />
        <div className="border-t border-moon-250 px-16 py-20">
          <Button
            icon="add-new"
            className="w-full"
            disabled={!reportId || submitting}
            onClick={async () => {
              try {
                setSubmitting(true);
                await exportPanelToReport({
                  report_id: reportId ? constString(reportId) : constNone(),
                  panel_id: localConfig.id
                    ? constString(localConfig.id)
                    : constNone(),
                });
                closePanelInteractDrawer();
                // TODO: open in new tab
              } catch (err) {
                // TODO: handle error
                console.error(err);
              } finally {
                setSubmitting(false);
              }
            }}>
            {submitting ? 'Adding panel...' : 'Add panel'}
          </Button>
        </div>
      </div>
    </Tailwind>
  );
};
