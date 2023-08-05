import React from 'react'
import classes from './Modal.module.css'

interface ModalProps {
    active: boolean
    setActive: (active: boolean) => void;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({active, setActive, children}) => {
        const isActiveModal = active ? `${classes.modal} ${classes.modal_active}` :  `${classes.modal} `
        const isActiveModalContent = active ? `${classes.modalContent} ${classes.modalContsent_active}` :  `${classes.modalContent} `
    
    return (
        <div className={isActiveModal} onClick = {() => setActive(false)}>
            <div className={isActiveModalContent} onClick = {e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}
//className={active ? "modal active" : "modal"} 
// const className= `${styles.button}  ${styles[`button_${color}`]}` 