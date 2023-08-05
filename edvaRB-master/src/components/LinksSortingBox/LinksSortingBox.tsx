
import React from 'react'
import { LinksSortingBoxRow } from '../LinksSortingBoxRow/LinksSortingBoxRow'
import classes from './LinksSortingBox.module.css'
import radioButton from '../../img/radio-button.svg'
import checkMark from '../../img/checkMark.svg'
interface LinksSortingBoxProps {
    history: HistoryTable[]
    selectLinkActive: boolean
    setSelectLinkActive:  (selectLinkActive: boolean) => void;
}

export const LinksSortingBox: React.FC<LinksSortingBoxProps> = ({history, selectLinkActive, setSelectLinkActive}) => {

    const [codeRowSelect ,setCodeRowSelect] = React.useState(false)
    const isActiveBox = selectLinkActive ? `${classes.contentWrapper} ${classes.contentWrapper_active}` :  `${classes.contentWrapper} `
    const isSelected = codeRowSelect ? `${classes.rowWrapper} ${classes.rowWrapper_active}` :  `${classes.rowWrapper} `

    return (
        <div className={isActiveBox}>
            <div className={classes.tableWrapper}>
                <div className={classes.selectLink}>
                    <button className={isSelected} onClick={() => setCodeRowSelect(!codeRowSelect)}>
                        <img src={codeRowSelect ? checkMark : radioButton} alt="" />
                        <div className={classes.rowText}>All</div>
                    </button>
                    {history.map((historyRow, index) => {
                        return (
                            <LinksSortingBoxRow key={index} code={historyRow.code} codeRowSelect={codeRowSelect} setCodeRowSelect={setCodeRowSelect} />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
