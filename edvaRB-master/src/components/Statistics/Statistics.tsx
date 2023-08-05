import React, { useEffect, useState } from 'react'
import classes from './Statistics.module.css'
import exclamatory from '../../img/exclamatory.svg'
import { HistoryTable } from '../HistoryTable/HistoryTable'
import { Modal } from '../Modal/Modal'
import arrow from '../../img/arrow.svg'
import { LinksSortingBox } from '../LinksSortingBox/LinksSortingBox'
interface IProps {

}

export const Statistics: React.FC<IProps> = ({}) => {

    const [modalActive ,setModalActive] = React.useState(false)
    const [selectLinkActive ,setSelectLinkActive] = React.useState(false)
    const history: HistoryTable[] = [
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
        },
        {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
          {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
        },
        {
            date: "10:03 03.12.2023",
            profit: 3300,
            code: "cvsg3sa",
          },
      ]
    const [referrals, setReferrals] = useState(0)

    const checkLength = history.length <= 6 ? {display: "none"} : {display: "block"}

    useEffect(() => {
        setTimeout(() => setReferrals(49), 1000)
    }, [])

    return (
        <div className={classes.statisticsWrapper}>
            <div className={classes.statisticsHeader}>
                <div className={classes.statisticsHeaderTitle}>Statistics</div>
                {/*<button className={classes.statisticsHeaderButton}>History</button>*/}
            </div>
            <div className={classes.demonstrationOfStatistics}>
                <div className={classes.demonstrationOfStatisticsSection}>
                    <div className={classes.statisticsValue}>24</div>
                    <div className={classes.demonstrationOfStatisticsDescription}>Invited</div>
                </div>
                <div className={classes.demonstrationOfStatisticsSection}>
                    <div className={classes.statisticsValue}>{referrals}</div>
                    <div className={classes.demonstrationOfStatisticsDescription}>
                        <div style={{marginRight:"5px"}}>Referrals</div>
                        <div className={classes.exclamatory}><img src={exclamatory} alt="" /></div>
                    </div>
                </div>
                <div className={classes.demonstrationOfStatisticsSection}>
                    <div className={classes.statisticsValue}>150.3400</div>
                    <div className={classes.demonstrationOfStatisticsDescription}>Earned SOL</div>
                </div>
            </div>
            <div className={classes.history}>
                <div className={classes.historyHeader}>History</div>
                <div className={classes.historyTableAndButtonWrapper}>
                    <HistoryTable
                        historyRowArr= {history}
                        isModal={false}
                    />
                    <div className={classes.historyButtonWrapper}>
                        <button className={classes.seeAllButton} style = {checkLength} onClick={() => setModalActive(true)}>See All</button>
                    </div>
                </div>

            </div>
            <Modal active={modalActive} setActive={setModalActive}>
                <div className={classes.modalContentWrappper}>
                    <div className={classes.modalHeaderWrapper}>
                        <div className={classes.selectWrapper}>
                            <button className={classes.selectButton} onClick={() => setSelectLinkActive(true)}>
                                <div className={classes.selecteTitle}>Select Link</div>
                                <div className={classes.selecteArrow}><img src={arrow} alt="" /></div>
                            </button>
                        </div>
                        {/* <div className={classes.selectLink}>1234</div> */}
                        <div className={classes.modalHeader}>History</div>
                        <button className={classes.clouseButton} onClick={() => setModalActive(false)}>×</button>
                    </div>
                    <LinksSortingBox
                        history={history}
                        setSelectLinkActive={setSelectLinkActive}
                        selectLinkActive={selectLinkActive}
                    />
                    <div className={classes.historyTableWrapper}>
                        <HistoryTable
                            historyRowArr= {history}
                            isModal={true}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    )
}
