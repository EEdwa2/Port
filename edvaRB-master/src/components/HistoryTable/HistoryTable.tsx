import React from 'react'
import { TableHeader } from '../TableHeader/TableHeader'
import classes from './HistoryTable.module.css'
import {HistoryTableRow} from "../HistotyTableRow/HistotyTableRow";

interface HistoryTableProps {
    historyRowArr: HistoryTable[]
    isModal: boolean
}

export const HistoryTable: React.FC<HistoryTableProps> = ({historyRowArr, isModal}) => {
    const shortHistoryhistoryRowArr: HistoryTable[]  = historyRowArr.length > 6 ? historyRowArr.slice(historyRowArr.length - 6) : historyRowArr
    const currentArr: HistoryTable[] = isModal ? historyRowArr : shortHistoryhistoryRowArr
    const scroll = isModal ? `${classes.tbody} ${classes.scroll}` :  `${classes.tbody} `
    console.log(shortHistoryhistoryRowArr);
    console.log(shortHistoryhistoryRowArr.length);

    return (
        <table className={classes.tableWrapper}>
        <TableHeader/>
        <tbody className={scroll}>
            {currentArr.map((historyRow, index) => {
                return (
                    <HistoryTableRow key={index}  historyRow={historyRow} isModal ={isModal}/>
                )
            })}
        </tbody>
        </table>
    )
}
