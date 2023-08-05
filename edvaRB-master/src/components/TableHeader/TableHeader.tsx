import React from 'react'
import classes from './TableHeader.module.css'
interface IProps {
    
}

export const TableHeader: React.FC<IProps> = ({}) => {
    
    return (
        // <thead>
            <tr className={classes.row}>
                <th className={classes.td}>Date</th>
                <th className={classes.td}>Code</th>
                <th className={classes.td}>Profit</th>
            </tr>
        // </thead>
    )
}