import React from 'react'
import classes from './LinksSortingBoxRow.module.css'
import radioButton from '../../img/radio-button.svg'
import checkMark from '../../img/checkMark.svg'
interface LinksSortingBoxProps {
    code: string
    codeRowSelect: boolean
    setCodeRowSelect:  (setCodeRowSelect: boolean) => void;
}

export const LinksSortingBoxRow: React.FC<LinksSortingBoxProps> = ({code, codeRowSelect, setCodeRowSelect}) => {
        const isSelected = codeRowSelect ? `${classes.rowWrapper} ${classes.rowWrapper_active}` :  `${classes.rowWrapper} `
    return (
        <button className={isSelected} onClick={() => setCodeRowSelect(!codeRowSelect)}>
            <img src={codeRowSelect ? checkMark : radioButton} alt="" />
            <div className={classes.rowText}>{code}</div>
        </button>
    )
}
