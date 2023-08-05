import React from 'react'
import classes from './HistotyTableRow.module.css'

interface HistoryTableRowProps {
    historyRow: HistoryTable
    isModal: boolean
}

export const HistoryTableRow: React.FC<HistoryTableRowProps> = ({historyRow, isModal}) => {
    const isActiveModal = isModal ? `${classes.td} ${classes.td_yellow}` :  `${classes.td} ${classes.td_green}`
    const profit = `+${historyRow.profit} SOL`

    return (
        <tr className={classes.tr}>
            <td className={classes.td}>{historyRow.date}</td>
            <td className={classes.td}>{historyRow.code}</td>
            <td className={isActiveModal}>{profit}</td>
        </tr>
    )
}
